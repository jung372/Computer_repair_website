import { env } from "cloudflare:workers";
import {
  addMarketingAsset,
  createMarketingJob,
  recordMarketingJobStatus,
} from "@/data/marketing-job-repository";
import { getAdminUser } from "@/lib/admin-auth";
import {
  MAX_MARKETING_PHOTOS,
  assertMarketingUploadTotalBytes,
  normalizeMarketingJobInput,
  sanitizeMarketingImage,
} from "@/lib/marketing/job-contract";
import { assertSameOrigin } from "@/lib/security/request-guard";

type MarketingBindings = {
  MARKETING_PHOTOS: {
    put(key: string, value: Uint8Array, options: unknown): Promise<unknown>;
    delete(key: string): Promise<void>;
  };
  MARKETING_JOBS: { send(message: unknown): Promise<void> };
};

export async function POST(request: Request) {
  let jobId = "";
  const uploadedKeys: string[] = [];
  try {
    assertSameOrigin(request);
    const owner = await getAdminUser();
    if (!owner || owner.role !== "OWNER") {
      return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return Response.json({ error: "사진 첨부가 가능한 폼 요청만 지원합니다." }, { status: 415 });
    }
    const form = await request.formData();
    const input = normalizeMarketingJobInput(Object.fromEntries(form.entries()));
    const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (photos.length > MAX_MARKETING_PHOTOS) throw new Error(`사진은 최대 ${MAX_MARKETING_PHOTOS}장까지 첨부할 수 있습니다.`);
    assertMarketingUploadTotalBytes(photos.reduce((total, photo) => total + photo.size, 0));
    if (photos.length && (!input.photoConsent || !input.privacyReviewed)) {
      throw new Error("사진 공개 동의와 개인정보 비식별 확인을 모두 완료해 주세요.");
    }
    jobId = `marketing_job_${crypto.randomUUID()}`;
    const requestedKey = String(form.get("idempotencyKey") || "").trim();
    const idempotencyKey = /^[a-zA-Z0-9._:-]{12,128}$/.test(requestedKey)
      ? requestedKey
      : crypto.randomUUID();
    const now = new Date().toISOString();
    await createMarketingJob({ ...input, id: jobId, requestedBy: owner.id, idempotencyKey, now });

    const bindings = env as unknown as MarketingBindings;
    if (!bindings.MARKETING_PHOTOS || !bindings.MARKETING_JOBS) throw new Error("MARKETING_BINDINGS_UNAVAILABLE");
    for (const [index, photo] of photos.entries()) {
      const clean = sanitizeMarketingImage(await photo.arrayBuffer(), photo.type);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", clean));
      const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const assetId = `marketing_asset_${crypto.randomUUID()}`;
      const mimeType = photo.type === "image/jpg" ? "image/jpeg" : photo.type;
      const extension = mimeType === "image/png" ? "png" : "jpg";
      const r2Key = `repair-jobs/${jobId}/${String(index + 1).padStart(2, "0")}-${assetId}.${extension}`;
      await bindings.MARKETING_PHOTOS.put(r2Key, clean, {
        httpMetadata: { contentType: mimeType, cacheControl: "private, no-store" },
        customMetadata: { sha256, jobId, sanitized: "exif-metadata-removed" },
      });
      uploadedKeys.push(r2Key);
      await addMarketingAsset({
        id: assetId,
        jobId,
        sequence: index + 1,
        r2Key,
        originalName: photo.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120),
        mimeType,
        size: clean.length,
        sha256,
      }, now);
    }

    await recordMarketingJobStatus(jobId, "QUEUED", owner.id, "로컬 생성 서버가 가져갈 안전 작업 큐에 등록했습니다.");
    const message = { jobId, schemaVersion: 1, event: "JOB_SUBMITTED" };
    await bindings.MARKETING_JOBS.send(message);
    return Response.json({ jobId, status: "QUEUED" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "마케팅 작업을 저장하지 못했습니다.";
    if (jobId) {
      await recordMarketingJobStatus(jobId, "FAILED", "website", "클라우드 작업 등록에 실패했습니다.", {
        failureCode: safeFailureCode(message),
      }).catch(() => undefined);
    }
    return Response.json({ error: publicError(message), ...(jobId ? { jobId } : {}) }, {
      status: message.includes("입력") || message.includes("선택") || message.includes("사진") || message.includes("서비스 지역") ? 400 : 500,
    });
  }
}

function safeFailureCode(message: string) {
  if (message === "MARKETING_BINDINGS_UNAVAILABLE") return message;
  if (/D1|database/i.test(message)) return "DATABASE_ERROR";
  if (/R2|bucket/i.test(message)) return "PHOTO_STORAGE_ERROR";
  if (/queue/i.test(message)) return "QUEUE_ERROR";
  return "SUBMISSION_ERROR";
}

function publicError(message: string) {
  if (message === "MARKETING_BINDINGS_UNAVAILABLE") return "마케팅 연동 설정을 확인해 주세요.";
  if (/입력|선택|사진|서비스 지역|원인/.test(message)) return message;
  return "작업을 저장하지 못했습니다. 실패 기록에서 원인을 확인해 주세요.";
}

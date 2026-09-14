import {
  addMarketingAsset,
  createMarketingJob,
  getMarketingJobByIdempotencyKey,
  listMarketingJobs,
  recordMarketingJobStatus,
  type MarketingJobRow,
} from "@/data/marketing-job-repository";
import {
  MAX_MARKETING_PHOTOS,
  MAX_MARKETING_UPLOAD_BYTES,
  assertMarketingUploadTotalBytes,
  normalizeMarketingJobInput,
  sanitizeMarketingImage,
} from "@/lib/marketing/job-contract";

const MAX_MULTIPART_BYTES = MAX_MARKETING_UPLOAD_BYTES + 1024 * 1024;

type MarketingBindings = Pick<Env, "MARKETING_PHOTOS" | "MARKETING_JOBS">;

export class MarketingJobSubmissionError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public jobId?: string,
  ) {
    super(message);
  }
}

export function publicMarketingJob(job: MarketingJobRow) {
  return {
    id: job.id,
    schemaVersion: job.schemaVersion,
    status: job.status,
    symptom: job.symptom,
    causeUnknown: job.causeUnknown,
    diagnosedCause: job.diagnosedCause,
    actionsTaken: job.actionsTaken,
    verificationResult: job.verificationResult,
    deviceInfo: job.deviceInfo,
    workDuration: job.workDuration,
    repairNotes: job.repairNotes,
    district: job.district,
    photoConsent: job.photoConsent,
    privacyReviewed: job.privacyReviewed,
    photoEvidenceNote: job.photoEvidenceNote,
    localJobId: job.localJobId,
    failureCode: job.failureCode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function listPublicMarketingJobs(limit: number) {
  return (await listMarketingJobs(limit)).map(publicMarketingJob);
}

export async function submitNewSiteMarketingJob(
  request: Request,
  requestedBy: string,
  bindings: MarketingBindings,
  clientIdempotencyKey: string,
) {
  const idempotencyKey = `new:${clientIdempotencyKey}`;
  const replay = await getMarketingJobByIdempotencyKey(idempotencyKey);
  if (replay) {
    return { jobId: replay.id, status: replay.status, replayed: true };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new MarketingJobSubmissionError(
      "UNSUPPORTED_MEDIA_TYPE",
      415,
      "사진 첨부가 가능한 multipart/form-data 요청만 지원합니다.",
    );
  }

  let jobId = "";
  const uploadedKeys: string[] = [];
  try {
    const bytes = await readBoundedRequestBytes(request, MAX_MULTIPART_BYTES);
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes,
    });
    const form = await boundedRequest.formData();
    const input = normalizeMarketingJobInput(Object.fromEntries(form.entries()));
    const photos = form.getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (photos.length > MAX_MARKETING_PHOTOS) {
      throw new Error(`사진은 최대 ${MAX_MARKETING_PHOTOS}장까지 첨부할 수 있습니다.`);
    }
    assertMarketingUploadTotalBytes(photos.reduce((total, photo) => total + photo.size, 0));
    if (photos.length && (!input.photoConsent || !input.privacyReviewed)) {
      throw new Error("사진 공개 동의와 개인정보 비식별 확인을 모두 완료해 주세요.");
    }

    jobId = `marketing_job_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    try {
      await createMarketingJob({ ...input, id: jobId, requestedBy, idempotencyKey, now });
    } catch (error) {
      const concurrentReplay = await getMarketingJobByIdempotencyKey(idempotencyKey).catch(() => null);
      if (concurrentReplay) {
        return { jobId: concurrentReplay.id, status: concurrentReplay.status, replayed: true };
      }
      throw error;
    }

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

    await recordMarketingJobStatus(
      jobId,
      "QUEUED",
      requestedBy,
      "로컬 생성 서버가 가져갈 안전 작업 큐에 등록했습니다.",
    );
    await bindings.MARKETING_JOBS.send({ jobId, schemaVersion: 1, event: "JOB_SUBMITTED" });
    return { jobId, status: "QUEUED", replayed: false };
  } catch (error) {
    if (error instanceof MarketingJobSubmissionError) throw error;
    if (uploadedKeys.length) {
      await Promise.all(uploadedKeys.map(async (key) => {
        try {
          await bindings.MARKETING_PHOTOS.delete(key);
        } catch {
          // The FAILED D1 record retains the cleanup evidence for operator review.
        }
      }));
    }
    const message = error instanceof Error ? error.message : "SUBMISSION_ERROR";
    if (jobId) {
      await recordMarketingJobStatus(
        jobId,
        "FAILED",
        "website",
        "클라우드 작업 등록에 실패했습니다.",
        { failureCode: safeFailureCode(message) },
      ).catch(() => undefined);
    }
    throw new MarketingJobSubmissionError(
      safeFailureCode(message),
      isInputError(message) ? 400 : 500,
      publicError(message),
      jobId || undefined,
    );
  }
}

async function readBoundedRequestBytes(request: Request, maximum: number) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximum) {
    throw new MarketingJobSubmissionError("PAYLOAD_TOO_LARGE", 413, "업로드 용량이 너무 큽니다.");
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) {
        await reader.cancel("marketing-upload-too-large").catch(() => undefined);
        throw new MarketingJobSubmissionError("PAYLOAD_TOO_LARGE", 413, "업로드 용량이 너무 큽니다.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function safeFailureCode(message: string) {
  if (/D1|database/i.test(message)) return "DATABASE_ERROR";
  if (/R2|bucket/i.test(message)) return "PHOTO_STORAGE_ERROR";
  if (/queue/i.test(message)) return "QUEUE_ERROR";
  return isInputError(message) ? "INVALID_INPUT" : "SUBMISSION_ERROR";
}

function isInputError(message: string) {
  return /입력|선택|사진|서비스 지역|원인|용량|형식/.test(message);
}

function publicError(message: string) {
  return isInputError(message)
    ? message
    : "작업을 저장하지 못했습니다. 실패 기록에서 원인을 확인해 주세요.";
}

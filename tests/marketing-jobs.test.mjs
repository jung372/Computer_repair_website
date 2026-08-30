import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MARKETING_DISTRICTS,
  normalizeMarketingJobInput,
  sanitizeMarketingImage,
} from "../lib/marketing/job-contract.ts";
import {
  PHOTO_COMPRESSION_PROFILES,
  selectPhotoCompressionProfile,
} from "../lib/logic/marketing-photo-compression.ts";

test("mobile repair photos expose bounded compression profiles", () => {
  assert.deepEqual(selectPhotoCompressionProfile("compact"), {
    id: "compact",
    label: "데이터 절약",
    maxDimension: 1600,
    targetBytes: 1024 * 1024,
    quality: 0.76,
  });
  assert.equal(selectPhotoCompressionProfile("recommended").targetBytes, 2 * 1024 * 1024);
  assert.equal(selectPhotoCompressionProfile("detail").maxDimension, 2560);
  assert.equal(selectPhotoCompressionProfile("unknown").id, "recommended");
  assert.equal(Object.keys(PHOTO_COMPRESSION_PROFILES).length, 3);
});

test("repair diary intake requires the minimum fact ledger and explicit photo privacy controls", () => {
  assert.throws(() => normalizeMarketingJobInput({
    symptom: "화면이 나오지 않음",
    causeUnknown: "true",
    actionsTaken: "메모리 재장착",
    verificationResult: "정상 부팅 확인",
    district: "강남구",
    photoConsent: "true",
    privacyReviewed: "true",
  }), /서비스 지역/);

  const input = normalizeMarketingJobInput({
    symptom: "화면이 나오지 않음",
    causeUnknown: "true",
    actionsTaken: "메모리 재장착",
    verificationResult: "정상 부팅 확인",
    district: "광진구",
    photoConsent: "true",
    privacyReviewed: "true",
  });
  assert.equal(input.causeUnknown, true);
  assert.equal(input.diagnosedCause, "");
  assert.deepEqual(MARKETING_DISTRICTS, ["광진구", "성동구", "동대문구"]);
});

test("JPEG sanitization removes EXIF APP1 metadata before R2 storage", () => {
  const exif = Buffer.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    exif,
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9]),
  ]);
  const clean = sanitizeMarketingImage(jpeg, "image/jpeg");
  assert.equal(Buffer.from(clean.subarray(0, 2)).toString("hex"), "ffd8");
  assert.equal(Buffer.from(clean).includes(Buffer.from("Exif")), false);
});

test("Cloudflare configuration keeps repair photos separate and queues only job references", async () => {
  const root = new URL("../", import.meta.url);
  const [wrangler, schema, route, nextRoute] = await Promise.all([
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/admin/marketing/jobs/route.ts", root), "utf8"),
    readFile(new URL("app/api/bridge/marketing/jobs/next/route.ts", root), "utf8"),
  ]);
  assert.match(wrangler, /"binding": "MARKETING_PHOTOS"/);
  assert.match(wrangler, /"binding": "MARKETING_JOBS"/);
  assert.match(schema, /marketingJobAssets/);
  assert.match(route, /schemaVersion:\s*1/);
  assert.match(route, /event:\s*"JOB_SUBMITTED"/);
  assert.doesNotMatch(route, /MARKETING_JOBS\.send\([^)]*(symptom|photo|asset)/s);
  assert.match(nextRoute, /authorizeMarketingBridge/);
});

test("owner menu opens the repair upload workbench and exposes mobile photo optimization", async () => {
  const root = new URL("../", import.meta.url);
  const [form, page, nav, compression] = await Promise.all([
    readFile(new URL("components/marketing-job-form.tsx", root), "utf8"),
    readFile(new URL("app/admin/marketing/page.tsx", root), "utf8"),
    readFile(new URL("components/admin-account-nav.tsx", root), "utf8"),
    readFile(new URL("lib/logic/marketing-photo-compression.ts", root), "utf8"),
  ]);
  assert.match(form, /removePhoto/);
  assert.match(form, /전체 초기화/);
  assert.match(form, /privacyReviewed/);
  assert.match(form, /블로그 공개 동의/);
  assert.match(form, /capture="environment"/);
  assert.match(compression, /데이터 절약/);
  assert.match(compression, /권장/);
  assert.match(compression, /고화질/);
  assert.match(form, /원본.*업로드/s);
  assert.match(page, /MarketingJobForm/);
  assert.match(page, /수리일지 등록/);
  assert.match(page, /작업 현황/);
  assert.match(page, /로컬 AI/);
  assert.match(page, /운영자 검토/);
  assert.match(nav, /수리일지 작업실/);
});

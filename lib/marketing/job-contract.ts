export const MARKETING_DISTRICTS = ["광진구", "성동구", "동대문구"] as const;
export const MAX_MARKETING_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_MARKETING_PHOTOS = 6;

type FormValue = FormDataEntryValue | string | boolean | null | undefined;

function text(value: FormValue, label: string, max: number, required = false) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (required && !normalized) throw new Error(`${label}을(를) 입력해 주세요.`);
  if (normalized.length > max) throw new Error(`${label}은(는) ${max}자 이하여야 합니다.`);
  return normalized;
}

function checked(value: FormValue) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export function normalizeMarketingJobInput(source: Record<string, FormValue>) {
  const causeUnknown = checked(source.causeUnknown);
  const diagnosedCause = text(source.diagnosedCause, "확인된 원인", 1000);
  if (!causeUnknown && !diagnosedCause) {
    throw new Error("확인된 원인을 입력하거나 원인 미확정을 선택해 주세요.");
  }
  const district = text(source.district, "서비스 지역", 20, true);
  if (!MARKETING_DISTRICTS.includes(district as (typeof MARKETING_DISTRICTS)[number])) {
    throw new Error("서비스 지역은 광진구, 성동구, 동대문구 중에서 선택해 주세요.");
  }
  return {
    symptom: text(source.symptom, "접수 증상", 2000, true),
    causeUnknown,
    diagnosedCause: causeUnknown ? "" : diagnosedCause,
    actionsTaken: text(source.actionsTaken, "실제 조치", 3000, true),
    verificationResult: text(source.verificationResult, "조치 후 확인 결과", 2000, true),
    deviceInfo: text(source.deviceInfo, "기기·부품 정보", 1000),
    workDuration: text(source.workDuration, "작업 시간", 200),
    repairNotes: text(source.repairNotes, "특이사항", 2000),
    district,
    photoConsent: checked(source.photoConsent),
    privacyReviewed: checked(source.privacyReviewed),
    photoEvidenceNote: text(source.photoEvidenceNote, "사진 동의·비식별 확인 메모", 1000),
  };
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

function sanitizeJpeg(input: Uint8Array) {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error("JPEG 파일 서명이 올바르지 않습니다.");
  }
  const parts = [input.slice(0, 2)];
  let offset = 2;
  while (offset < input.length) {
    if (input[offset] !== 0xff || offset + 1 >= input.length) throw new Error("JPEG 구조가 올바르지 않습니다.");
    const marker = input[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(input.slice(offset));
      offset = input.length;
      break;
    }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > input.length) throw new Error("JPEG 세그먼트가 잘렸습니다.");
    const length = (input[offset + 2] << 8) | input[offset + 3];
    if (length < 2 || offset + 2 + length > input.length) throw new Error("JPEG 세그먼트 길이가 올바르지 않습니다.");
    const end = offset + 2 + length;
    if (![0xe1, 0xed, 0xfe].includes(marker)) parts.push(input.slice(offset, end));
    offset = end;
  }
  return concat(parts);
}

function sanitizePng(input: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (input.length < 20 || !signature.every((byte, index) => input[index] === byte)) {
    throw new Error("PNG 파일 서명이 올바르지 않습니다.");
  }
  const parts = [input.slice(0, 8)];
  const blocked = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);
  let offset = 8;
  let reachedEnd = false;
  while (offset + 12 <= input.length) {
    const view = new DataView(input.buffer, input.byteOffset + offset, 4);
    const length = view.getUint32(0, false);
    const end = offset + 12 + length;
    if (end > input.length) throw new Error("PNG 청크가 잘렸습니다.");
    const type = String.fromCharCode(...input.slice(offset + 4, offset + 8));
    if (!blocked.has(type)) parts.push(input.slice(offset, end));
    offset = end;
    if (type === "IEND") {
      reachedEnd = true;
      break;
    }
  }
  if (!reachedEnd) throw new Error("PNG 종료 청크가 없습니다.");
  return concat(parts);
}

export function sanitizeMarketingImage(value: ArrayBuffer | Uint8Array, mimeType: string) {
  const input = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (!input.length || input.length > MAX_MARKETING_PHOTO_BYTES) {
    throw new Error(`사진은 1바이트 이상 ${MAX_MARKETING_PHOTO_BYTES}바이트 이하여야 합니다.`);
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return sanitizeJpeg(input);
  if (mimeType === "image/png") return sanitizePng(input);
  throw new Error("수리 사진은 JPEG 또는 PNG 형식만 업로드할 수 있습니다.");
}

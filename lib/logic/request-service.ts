import {
  clearAccessFailures,
  findRequestByPublicId,
  getAccessAttempt,
  insertRequest,
  listStatusHistory,
  recordAccessFailure,
} from "@/data/request-repository";
import { assertLookupSecretReady } from "@/data/security-settings-repository";
import {
  DEVICE_TYPES,
  type DeviceType,
  type ServiceRequestRecord,
} from "@/lib/domain";
import { getInitialNotificationStatus } from "@/lib/notification-config";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { createLookupKey } from "@/lib/security/lookup-key";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { generateLookupCode } from "@/lib/security/generated-lookup-code";

const PRIVACY_NOTICE_VERSION = "2026-08-23.v3";
const PRIVACY_LEGAL_BASIS = "PIPA_15_1_4_CONTRACT_REQUEST";
// 고객이 쓴 내용을 조용히 잘라내지 않기 위한 방어선. 화면에는 제한을 두지 않는다.
const DESCRIPTION_LIMIT = 20_000;

export class RequestValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("입력 내용을 확인해 주세요.");
  }
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicRegion(address: string) {
  const parts = address.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ") || "지역 미입력";
}

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function createPublicId(now: Date) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `R-${date}-${randomSuffix()}`;
}

export function maskName(name: string) {
  if (name.length <= 1) return "*";
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(Math.min(2, name.length - 1))}`;
}

export function maskPhone(phone: string) {
  if (phone.length < 7) return "***-****";
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}

export async function createServiceRequest(input: unknown) {
  const values = isRecord(input) ? input : {};
  const fields: Record<string, string> = {};
  const name = clean(values.name, 30) || "미상";
  const phone = normalizePhone(clean(values.phone, 30));
  const address1 = clean(values.address1, 160);
  const address2 = clean(values.address2, 160);
  const manufacturerModel = clean(values.manufacturerModel, 100);
  const symptom = clean(values.symptom, 120);
  const description = clean(values.description, DESCRIPTION_LIMIT);
  const submittedPassword = typeof values.password === "string" ? values.password : "";
  const generatedLookupCode = submittedPassword ? null : generateLookupCode();
  const lookupCredential = generatedLookupCode ?? submittedPassword;
  const passwordLength = Array.from(submittedPassword).length;
  const deviceType = DEVICE_TYPES.includes(values.deviceType as DeviceType)
    ? (values.deviceType as DeviceType)
    : null;

  if (values.website) fields.website = "자동 신청으로 판단되었습니다.";
  if (phone.length < 10 || phone.length > 11) fields.phone = "연락처 10~11자리를 확인해 주세요.";
  if (!address1) fields.address1 = "기본 주소를 입력해 주세요.";
  if (!deviceType) fields.deviceType = "기기 종류를 선택해 주세요.";
  if (!symptom) fields.symptom = "대표 증상을 입력해 주세요.";
  if (
    typeof values.description === "string" &&
    values.description.trim().length > DESCRIPTION_LIMIT
  ) {
    fields.description = `접수 내용은 ${DESCRIPTION_LIMIT.toLocaleString("ko-KR")}자 이내로 입력해 주세요.`;
  }
  if (submittedPassword && (passwordLength < 4 || passwordLength > 20)) {
    fields.password = "신청 조회 비밀번호는 4~20자로 입력해 주세요.";
  }
  if (Object.keys(fields).length) throw new RequestValidationError(fields);

  await assertLookupSecretReady();
  const [accessPasswordHash, lookupKey] = await Promise.all([
    hashPassword(lookupCredential),
    createLookupKey(phone, lookupCredential),
  ]);
  const now = new Date();
  const timestamp = now.toISOString();
  const request: ServiceRequestRecord & {
    privacyConsentVersion: string;
    privacyConsentedAt: string;
    privacyLegalBasis: string;
    privacyNoticeVersion: string;
    privacyNoticePresentedAt: string;
  } = {
    id: crypto.randomUUID(),
    publicId: createPublicId(now),
    name,
    // Stored in canonical hyphenated form; lookup_key above still uses digits.
    phone: formatPhone(phone),
    postalCode: "",
    address1,
    address2,
    regionPublic: publicRegion(address1),
    deviceType: deviceType!,
    manufacturerModel,
    symptom,
    description,
    visibility: "PRIVATE",
    accessPasswordHash,
    lookupKey,
    status: "RECEIVED",
    // 희망 방문 일시는 더 이상 수집하지 않는다. 컬럼은 과거 접수 건 보존용으로만 남는다.
    preferredAt: null,
    internalNote: "",
    notificationStatus: getInitialNotificationStatus(),
    notificationError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    privacyConsentVersion: "",
    privacyConsentedAt: "",
    privacyLegalBasis: PRIVACY_LEGAL_BASIS,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    privacyNoticePresentedAt: timestamp,
  };
  await insertRequest(request);
  return { request, generatedLookupCode };
}

export async function getRequestDetail(publicId: string) {
  const request = await findRequestByPublicId(clean(publicId, 40));
  if (!request) return null;
  return { request, history: await listStatusHistory(request.id) };
}

export async function verifyPrivateRequestAccess(
  publicId: string,
  password: string,
  clientHash: string,
) {
  const request = await findRequestByPublicId(publicId);
  if (!request || request.visibility !== "PRIVATE" || !request.accessPasswordHash) {
    return { ok: false, reason: "NOT_FOUND" as const };
  }
  const key = `${publicId}:${clientHash}`;
  const attempt = await getAccessAttempt(key);
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    return { ok: false, reason: "BLOCKED" as const };
  }
  const valid = await verifyPassword(password, request.accessPasswordHash);
  if (!valid) {
    await recordAccessFailure(key);
    return { ok: false, reason: "INVALID" as const };
  }
  await clearAccessFailures(key);
  return { ok: true, reason: "OK" as const };
}

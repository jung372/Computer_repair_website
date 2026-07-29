import {
  clearAccessFailures,
  findRequestByPublicId,
  getAccessAttempt,
  insertRequest,
  listPublicRequests,
  listStatusHistory,
  recordAccessFailure,
} from "@/data/request-repository";
import {
  DEVICE_TYPES,
  type DeviceType,
  type PublicRequestSummary,
  type RequestStatus,
  type ServiceRequestRecord,
} from "@/lib/domain";
import { hashPassword, verifyPassword } from "@/lib/security/password";

const PRIVACY_VERSION = "2026-07-28.v1";

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

export function toPublicSummary(row: {
  public_id: string;
  name: string;
  region_public: string;
  device_type: DeviceType;
  symptom: string;
  visibility: ServiceRequestRecord["visibility"];
  status: RequestStatus;
  created_at: string;
}): PublicRequestSummary {
  return {
    publicId: row.public_id,
    maskedName: maskName(row.name),
    regionPublic: row.region_public,
    deviceType: row.device_type,
    symptom: row.symptom,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createServiceRequest(input: unknown) {
  const values = isRecord(input) ? input : {};
  const fields: Record<string, string> = {};
  const name = clean(values.name, 30);
  const phone = clean(values.phone, 30).replace(/\D/g, "");
  const postalCode = clean(values.postalCode, 12);
  const address1 = clean(values.address1, 160);
  const address2 = clean(values.address2, 160);
  const manufacturerModel = clean(values.manufacturerModel, 100);
  const symptom = clean(values.symptom, 120);
  const description = clean(values.description, 2_000);
  const preferredAt = clean(values.preferredAt, 40) || null;
  const visibility = values.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  const password = typeof values.password === "string" ? values.password : "";
  const deviceType = DEVICE_TYPES.includes(values.deviceType as DeviceType)
    ? (values.deviceType as DeviceType)
    : null;

  if (values.website) fields.website = "자동 신청으로 판단되었습니다.";
  if (name.length < 2) fields.name = "이름을 2자 이상 입력해 주세요.";
  if (phone.length < 10 || phone.length > 11) fields.phone = "연락처 10~11자리를 확인해 주세요.";
  if (!postalCode) fields.postalCode = "우편번호를 입력해 주세요.";
  if (!address1) fields.address1 = "기본 주소를 입력해 주세요.";
  if (!address2) fields.address2 = "상세 주소를 입력해 주세요.";
  if (!deviceType) fields.deviceType = "기기 종류를 선택해 주세요.";
  if (!symptom) fields.symptom = "대표 증상을 입력해 주세요.";
  if (description.length < 10) fields.description = "접수 내용을 10자 이상 입력해 주세요.";
  if (visibility === "PRIVATE" && (password.length < 8 || password.length > 64)) {
    fields.password = "비공개 비밀번호는 8~64자로 입력해 주세요.";
  }
  if (values.privacyConsent !== true) fields.privacyConsent = "개인정보 수집·이용 동의가 필요합니다.";
  if (Object.keys(fields).length) throw new RequestValidationError(fields);

  const now = new Date();
  const timestamp = now.toISOString();
  const request: ServiceRequestRecord & {
    privacyConsentVersion: string;
    privacyConsentedAt: string;
  } = {
    id: crypto.randomUUID(),
    publicId: createPublicId(now),
    name,
    phone,
    postalCode,
    address1,
    address2,
    regionPublic: publicRegion(address1),
    deviceType: deviceType!,
    manufacturerModel,
    symptom,
    description,
    visibility,
    accessPasswordHash: visibility === "PRIVATE" ? await hashPassword(password) : null,
    status: "RECEIVED",
    preferredAt,
    internalNote: "",
    notificationStatus: "PENDING",
    notificationError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    privacyConsentVersion: PRIVACY_VERSION,
    privacyConsentedAt: timestamp,
  };
  await insertRequest(request);
  return request;
}

export async function getPublicBoard(search = "", status = "") {
  const safeSearch = clean(search, 80);
  const safeStatus = clean(status, 30);
  const rows = await listPublicRequests(safeSearch, safeStatus);
  return rows.map(toPublicSummary);
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
    await recordAccessFailure(key, Number(attempt?.failures ?? 0));
    return { ok: false, reason: "INVALID" as const };
  }
  await clearAccessFailures(key);
  return { ok: true, reason: "OK" as const };
}

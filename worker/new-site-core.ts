import { WorkerEntrypoint } from "cloudflare:workers";
import {
  NEW_SITE_CUSTOMER_LOOKUP_COOKIE,
  createCustomerLookupSession,
  customerLookupSessionCanAccess,
  deleteCustomerLookupSession,
} from "../data/customer-lookup-repository";
import {
  countAdminRequestRecords,
  getAdminRequestRecord,
  listAdminRequestRecords,
  assignAdminRequest,
} from "../data/admin-request-repository";
import { listAssignmentOptions, listStaffSlots } from "../data/staff-slot-repository";
import { getSettlementReport } from "../data/settlement-repository";
import {
  listAllBlogPosts,
  listPublishedBlogPosts,
  setBlogPostVisibility,
  upsertPublishedBlogPost,
  getBlogSyncState,
  recordBlogSyncFailure,
  recordBlogSyncSuccess,
} from "../data/blog-post-repository";
import { listStatusHistory } from "../data/request-repository";
import {
  NEW_SITE_ADMIN_SESSION_COOKIE,
  authenticateExistingAdminCredentials,
  createNewSiteAdminSessionToken,
  getNewSiteAdminUser,
} from "../lib/admin-auth";
import { ADMIN_LOGIN_NAME, normalizeLoginName } from "../lib/account-policy";
import { isValidStaffPassword } from "../lib/account-policy";
import {
  authenticateCustomerLookup,
  CustomerLookupError,
  getCustomerLookupRequests,
} from "../lib/logic/customer-lookup";
import {
  createServiceRequest,
  getRequestDetail,
  maskName,
  maskPhone,
  RequestValidationError,
  verifyPrivateRequestAccess,
} from "../lib/logic/request-service";
import { hashClientAddress, hashLookupPhone } from "../lib/security/request-guard";
import {
  clearAccessFailures,
  getAccessAttempt,
  recordAccessFailure,
  hasNewSiteSubmissionIdempotencyKey,
} from "../data/request-repository";
import { getRuntimeString } from "../lib/runtime-config";
import { handleVoxWebhook } from "../app/api/integrations/vox/webhook/route";
import { normalizePublishedPostInput } from "../lib/blog/post-contract";
import {
  changeRequestStatus,
  removeRequestPersonalData,
  retryRequestNotification,
} from "../lib/logic/admin-service";
import {
  AdminRecordAuthorizationError,
  AdminRecordValidationError,
  saveAdminRequestRecord,
} from "../lib/logic/admin-record-service";
import {
  addStaffToSlot,
  changeSlotStaffPassword,
  deleteUnusedStaffFromSlot,
  editStaffInSlot,
  offboardStaffFromSlot,
  updateStaffSlotSettings,
} from "../lib/logic/staff-slot-service";
import {
  createPrimaryAdmin,
  changeAccountPassword,
  getAdminAccountById,
  getPrimaryAdmin,
  recordAdminAudit,
} from "../data/admin-repository";
import { hashPassword, verifyPassword } from "../lib/security/password";
import { constantTimeEqualStrings } from "../lib/security/constant-time";
import {
  getVoxIntegrationSummary,
  listVoxIntegrationIntakes,
} from "../data/integration-intake-repository";
import {
  listPublicMarketingJobs,
  MarketingJobSubmissionError,
  submitNewSiteMarketingJob,
} from "../lib/logic/marketing-job-service";

const MAX_JSON_BYTES = 256 * 1024;
const MAX_RSS_BYTES = 1024 * 1024;

type JsonObject = Record<string, unknown>;

function privateHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}

function success(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json({ ok: true, data }, { status, headers: privateHeaders(headers) });
}

function failure(code: string, message: string, status: number, fields?: Record<string, string>) {
  return Response.json(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status, headers: privateHeaders() },
  );
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(request: Request, maximum = MAX_JSON_BYTES): Promise<JsonObject> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new CoreHttpError("UNSUPPORTED_MEDIA_TYPE", 415, "JSON 요청만 지원합니다.");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maximum) {
    throw new CoreHttpError("PAYLOAD_TOO_LARGE", 413, "요청 본문이 너무 큽니다.");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maximum) {
    throw new CoreHttpError("PAYLOAD_TOO_LARGE", 413, "요청 본문이 너무 큽니다.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CoreHttpError("INVALID_REQUEST", 400, "JSON 형식을 확인해 주세요.");
  }
  if (!isObject(parsed)) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "JSON 객체가 필요합니다.");
  }
  return parsed;
}

function cookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function setCookie(name: string, value: string, maxAge: number, sameSite: "Lax" | "Strict") {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=${sameSite}`;
}

function parsePositiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

class CoreHttpError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

async function requireAdmin(request: Request) {
  const admin = await getNewSiteAdminUser(cookie(request, NEW_SITE_ADMIN_SESSION_COOKIE));
  if (!admin) throw new CoreHttpError("AUTH_REQUIRED", 401, "로그인이 필요합니다.");
  return admin;
}

function publicCustomerRequest(request: Awaited<ReturnType<typeof getCustomerLookupRequests>>[number]) {
  return {
    publicId: request.publicId,
    deviceType: request.deviceType,
    manufacturerModel: request.manufacturerModel,
    symptom: request.symptom,
    status: request.status,
    createdAt: request.createdAt,
  };
}

async function customerRequests(request: Request) {
  const token = cookie(request, NEW_SITE_CUSTOMER_LOOKUP_COOKIE);
  const requests = await getCustomerLookupRequests(token, "new");
  if (!token || requests.length === 0) {
    throw new CoreHttpError("AUTH_REQUIRED", 401, "조회 인증이 필요합니다.");
  }
  const data = await Promise.all(requests.map(async (item) => ({
    ...publicCustomerRequest(item),
    history: (await listStatusHistory(item.id)).map((history) => ({
      status: history.status,
      publicNote: history.publicNote,
      createdAt: history.createdAt,
    })),
  })));
  return success({ requests: data });
}

async function customerRequestDetail(request: Request, publicId: string) {
  const token = cookie(request, NEW_SITE_CUSTOMER_LOOKUP_COOKIE);
  if (!token) throw new CoreHttpError("AUTH_REQUIRED", 401, "조회 인증이 필요합니다.");
  const detail = await getRequestDetail(publicId);
  if (
    !detail ||
    !(await customerLookupSessionCanAccess(token, detail.request.id, "new"))
  ) {
    throw new CoreHttpError("AUTH_REQUIRED", 401, "조회 인증이 필요합니다.");
  }
  const { request: stored, history } = detail;
  return success({
    request: {
      publicId: stored.publicId,
      deviceType: stored.deviceType,
      manufacturerModel: stored.manufacturerModel,
      symptom: stored.symptom,
      description: stored.description,
      regionPublic: stored.regionPublic,
      status: stored.status,
      createdAt: stored.createdAt,
      maskedName: maskName(stored.name),
      maskedPhone: maskPhone(stored.phone),
    },
    history: history.map((item) => ({
      status: item.status,
      publicNote: item.publicNote,
      createdAt: item.createdAt,
    })),
  });
}

async function unlockCustomerRequest(request: Request, publicId: string) {
  const body = await readJsonObject(request);
  const password = typeof body.password === "string" ? body.password : "";
  const length = Array.from(password).length;
  if (length < 4 || length > 64) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "입력 정보를 확인해 주세요.");
  }
  const result = await verifyPrivateRequestAccess(
    publicId,
    password,
    await hashClientAddress(request),
  );
  if (!result.ok) {
    throw result.reason === "BLOCKED"
      ? new CoreHttpError("RATE_LIMITED", 429, "입력 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.")
      : new CoreHttpError("AUTH_REQUIRED", 401, "입력 정보를 확인해 주세요.");
  }
  const detail = await getRequestDetail(publicId);
  if (!detail) throw new CoreHttpError("AUTH_REQUIRED", 401, "입력 정보를 확인해 주세요.");
  const session = await createCustomerLookupSession([detail.request.id], "new");
  return success(
    { unlocked: true, publicId: detail.request.publicId },
    200,
    { "Set-Cookie": setCookie(NEW_SITE_CUSTOMER_LOOKUP_COOKIE, session.token, 600, "Lax") },
  );
}

async function createCustomerSession(request: Request) {
  const body = await readJsonObject(request);
  const phone = typeof body.phone === "string" ? body.phone : "";
  const session = await authenticateCustomerLookup(
    body,
    await hashClientAddress(request),
    await hashLookupPhone(phone),
    "new",
  );
  return success(
    { authenticated: true },
    200,
    { "Set-Cookie": setCookie(NEW_SITE_CUSTOMER_LOOKUP_COOKIE, session.token, 600, "Lax") },
  );
}

async function createRequest(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[\x21-\x7e]{8,128}$/.test(key)) {
    throw new CoreHttpError("IDEMPOTENCY_REQUIRED", 400, "유효한 멱등 키가 필요합니다.");
  }
  const body = await readJsonObject(request);
  if (getRuntimeString("REQUEST_SUBMISSION_ENABLED").toLowerCase() === "false") {
    throw new CoreHttpError("SERVICE_UNAVAILABLE", 503, "현재 접수 시스템을 점검하고 있습니다.");
  }
  const submissionKey = `request-submit:${await hashClientAddress(request)}`;
  const attempt = await getAccessAttempt(submissionKey);
  const replayCandidate = await hasNewSiteSubmissionIdempotencyKey(key);
  if (
    !replayCandidate && attempt?.blocked_until &&
    new Date(attempt.blocked_until).getTime() > Date.now()
  ) throw new CoreHttpError("RATE_LIMITED", 429, "접수 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
  const result = await createServiceRequest(body, {
    sourceSite: "new",
    idempotencyKey: key,
  });
  if (!result.replayed) await recordAccessFailure(submissionKey);
  const session = await createCustomerLookupSession([result.request.id], "new").catch(() => null);
  const headers = session
    ? { "Set-Cookie": setCookie(NEW_SITE_CUSTOMER_LOOKUP_COOKIE, session.token, 600, "Lax") }
    : undefined;
  return success(
    { publicId: result.request.publicId, replayed: result.replayed },
    result.replayed ? 200 : 201,
    headers,
  );
}

async function createAdminSession(request: Request) {
  const body = await readJsonObject(request);
  const loginName = normalizeLoginName(body.loginName);
  const password = typeof body.password === "string" ? body.password : "";
  if (loginName.length > 80 || Array.from(password).length > 200) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "로그인 입력을 확인해 주세요.");
  }
  const clientHash = await hashClientAddress(request);
  const ipKey = `admin-ip:${clientHash}`;
  const accountKey = `admin-account:${loginName || "empty"}`;
  const attempts = await Promise.all([getAccessAttempt(ipKey), getAccessAttempt(accountKey)]);
  if (attempts.some((attempt) => attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now())) {
    throw new CoreHttpError("RATE_LIMITED", 429, "입력 횟수를 초과했습니다.");
  }
  const account = await authenticateExistingAdminCredentials(loginName, password, clientHash);
  if (!account) {
    await Promise.all([recordAccessFailure(ipKey), recordAccessFailure(accountKey)]);
    throw new CoreHttpError("AUTH_REQUIRED", 401, "로그인 정보를 확인해 주세요.");
  }
  await Promise.all([clearAccessFailures(ipKey), clearAccessFailures(accountKey)]);
  const user = { id: account.id, loginName: account.loginName, displayName: account.displayName, role: account.role };
  return success(
    { user },
    200,
    { "Set-Cookie": setCookie(NEW_SITE_ADMIN_SESSION_COOKIE, await createNewSiteAdminSessionToken(account), 28800, "Strict") },
  );
}

async function listAdminRequests(request: Request) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100000);
  const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), 50, 100);
  const filters = {
    q: url.searchParams.get("q")?.slice(0, 100),
    assignee: url.searchParams.get("assignee")?.slice(0, 100),
    customerType: url.searchParams.get("customerType")?.slice(0, 80),
    integratedFrom: url.searchParams.get("from")?.slice(0, 10),
    integratedTo: url.searchParams.get("to")?.slice(0, 10),
    statuses: url.searchParams.getAll("status").slice(0, 20),
    sourceSite: url.searchParams.get("sourceSite") ?? undefined,
    sourceChannel: url.searchParams.get("sourceChannel") ?? undefined,
  };
  const assigned = admin.role === "STAFF" ? admin.id : undefined;
  const [requests, total] = await Promise.all([
    listAdminRequestRecords(filters, pageSize, assigned, (page - 1) * pageSize),
    countAdminRequestRecords(filters, assigned),
  ]);
  return success({
    requests,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

async function adminRequestDetail(request: Request, publicId: string) {
  const admin = await requireAdmin(request);
  const record = await getAdminRequestRecord(publicId, admin.role === "STAFF" ? admin.id : undefined);
  if (!record) throw new CoreHttpError("FORBIDDEN", 403, "이 접수에 접근할 권한이 없습니다.");
  return success({ request: record, history: await listStatusHistory(record.id) });
}

async function patchAdminRequest(request: Request, publicId: string) {
  const admin = await requireAdmin(request);
  const body = await readJsonObject(request);
  const visible = await getAdminRequestRecord(publicId, admin.role === "STAFF" ? admin.id : undefined);
  if (!visible) throw new CoreHttpError("FORBIDDEN", 403, "이 접수에 접근할 권한이 없습니다.");
  const action = body.action;
  if (action === "save-record") await saveAdminRequestRecord(publicId, body, admin);
  else if (action === "update") await changeRequestStatus(publicId, body, admin.loginName);
  else if (action === "assign") {
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    await assignAdminRequest(
      publicId,
      typeof body.assigneeAccountId === "string" ? body.assigneeAccountId.trim() || null : null,
      admin.id,
      typeof body.expectedAssigneeAccountId === "string" ? body.expectedAssigneeAccountId.trim() || null : undefined,
    );
  } else if (action === "retry-notification") {
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    if (!(await retryRequestNotification(publicId))) throw new CoreHttpError("NOT_FOUND", 404, "접수를 찾을 수 없습니다.");
  } else if (action === "anonymize") {
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    if (!(await removeRequestPersonalData(publicId, admin.loginName))) throw new CoreHttpError("NOT_FOUND", 404, "접수를 찾을 수 없습니다.");
  } else throw new CoreHttpError("INVALID_REQUEST", 400, "지원하지 않는 작업입니다.");
  return success({ updated: true });
}

async function settlements(request: Request) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "조회 기간을 확인해 주세요.");
  }
  return success(await getSettlementReport({
    from,
    to,
    assignee: url.searchParams.get("assignee") ?? undefined,
    paymentMethods: url.searchParams.getAll("paymentMethod").slice(0, 20),
    statuses: url.searchParams.getAll("status").slice(0, 20),
    page: parsePositiveInteger(url.searchParams.get("page"), 1, 100000),
    pageSize: parsePositiveInteger(url.searchParams.get("pageSize"), 50, 100),
  }, admin.role === "STAFF" ? admin.id : undefined));
}

async function mutateStaff(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
  const body = await readJsonObject(request);
  switch (body.action) {
    case "save-slot": await updateStaffSlotSettings(admin.id, body); break;
    case "create": await addStaffToSlot(admin.id, body); break;
    case "edit": await editStaffInSlot(admin.id, body); break;
    case "reset-password": await changeSlotStaffPassword(admin.id, body); break;
    case "offboard": await offboardStaffFromSlot(admin.id, body); break;
    case "delete": await deleteUnusedStaffFromSlot(admin.id, body); break;
    default: throw new CoreHttpError("INVALID_REQUEST", 400, "지원하지 않는 직원 작업입니다.");
  }
  return success({ updated: true });
}

async function changeAdminPassword(request: Request) {
  const admin = await requireAdmin(request);
  const body = await readJsonObject(request);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const clientHash = await hashClientAddress(request);
  const key = `admin-password:${admin.id}:${clientHash}`;
  const attempt = await getAccessAttempt(key);
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    throw new CoreHttpError("RATE_LIMITED", 429, "입력 횟수를 초과했습니다.");
  }
  const account = await getAdminAccountById(admin.id);
  if (!account?.isActive) throw new CoreHttpError("AUTH_REQUIRED", 401, "로그인이 필요합니다.");
  if (!(await verifyPassword(currentPassword, account.passwordHash))) {
    await recordAccessFailure(key);
    await recordAdminAudit("PASSWORD_CHANGE_FAILED", clientHash, account.id);
    throw new CoreHttpError("AUTH_REQUIRED", 401, "현재 비밀번호를 확인해 주세요.");
  }
  if (await verifyPassword(newPassword, account.passwordHash)) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "현재 비밀번호와 다른 비밀번호를 사용해 주세요.");
  }
  const length = Array.from(newPassword).length;
  const valid = account.role === "OWNER"
    ? length >= 12 && length <= 64
    : isValidStaffPassword(newPassword);
  if (!valid || newPassword !== confirmPassword) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "새 비밀번호를 확인해 주세요.");
  }
  await changeAccountPassword(account.id, await hashPassword(newPassword), clientHash);
  await clearAccessFailures(key);
  return success({ changed: true }, 200, {
    "Set-Cookie": setCookie(NEW_SITE_ADMIN_SESSION_COOKIE, "", 0, "Strict"),
  });
}

async function adminSetupStatus() {
  const ownerExists = Boolean(await getPrimaryAdmin());
  return success({
    ownerExists,
    setupAllowed: !ownerExists && Boolean(getRuntimeString("ADMIN_SETUP_TOKEN")),
  });
}

async function createInitialAdmin(request: Request) {
  if (await getPrimaryAdmin()) {
    throw new CoreHttpError("CONFLICT", 409, "최초 운영자 설정이 이미 완료되었습니다.");
  }
  const clientHash = await hashClientAddress(request);
  const key = `admin-setup:${clientHash}`;
  const attempt = await getAccessAttempt(key);
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    throw new CoreHttpError("RATE_LIMITED", 429, "입력 횟수를 초과했습니다.");
  }
  const expectedToken = getRuntimeString("ADMIN_SETUP_TOKEN");
  if (!expectedToken) {
    throw new CoreHttpError("SERVICE_UNAVAILABLE", 503, "최초 운영자 설정이 비활성 상태입니다.");
  }
  const body = await readJsonObject(request);
  const setupToken = typeof body.setupToken === "string" ? body.setupToken : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const passwordLength = Array.from(newPassword).length;
  if (
    !setupToken ||
    !(await constantTimeEqualStrings(setupToken, expectedToken)) ||
    passwordLength < 12 ||
    passwordLength > 64 ||
    newPassword !== confirmPassword
  ) {
    await recordAccessFailure(key);
    await recordAdminAudit("SETUP_FAILED", clientHash);
    throw new CoreHttpError("INVALID_REQUEST", 400, "초기 설정 정보를 확인해 주세요.");
  }
  try {
    await createPrimaryAdmin(await hashPassword(newPassword), clientHash);
  } catch (error) {
    if (await getPrimaryAdmin().catch(() => null)) {
      throw new CoreHttpError("CONFLICT", 409, "최초 운영자 설정이 이미 완료되었습니다.");
    }
    throw error;
  }
  // Successful bootstrap proves ownership. Discard pre-account login failures
  // for this owner and setup client so the first login is not still blocked.
  await Promise.all([
    clearAccessFailures(key),
    clearAccessFailures(`admin-account:${ADMIN_LOGIN_NAME}`),
    clearAccessFailures(`admin-ip:${clientHash}`),
  ]);
  return success({ configured: true }, 201);
}

async function adminMarketingJobs(request: Request, bindings: Env) {
  const admin = await requireAdmin(request);
  if (admin.role !== "OWNER") {
    throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
  }
  if (request.method.toUpperCase() === "GET") {
    const limit = parsePositiveInteger(new URL(request.url).searchParams.get("limit"), 50, 100);
    return success({ jobs: await listPublicMarketingJobs(limit) });
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[a-zA-Z0-9._:-]{12,128}$/.test(idempotencyKey)) {
    throw new CoreHttpError("IDEMPOTENCY_REQUIRED", 400, "유효한 멱등 키가 필요합니다.");
  }
  const result = await submitNewSiteMarketingJob(request, admin.id, bindings, idempotencyKey);
  return success(result, result.replayed ? 200 : 201);
}

async function adminVoxStatus(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.role !== "OWNER") {
    throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
  }
  const limit = parsePositiveInteger(new URL(request.url).searchParams.get("limit"), 50, 100);
  const [summary, rows] = await Promise.all([
    getVoxIntegrationSummary(),
    listVoxIntegrationIntakes(limit),
  ]);
  const checks = {
    processingEnabled: getRuntimeString("NEW_SITE_VOX_PROCESSING_ENABLED").toLowerCase() === "true",
    webhookEnabled: getRuntimeString("VOX_WEBHOOK_ENABLED").toLowerCase() === "true",
    signatureConfigured: Boolean(getRuntimeString("VOX_WEBHOOK_SECRET")),
    agentConfigured: Boolean(getRuntimeString("VOX_AGENT_ID")),
    inboundNumberConfigured: Boolean(getRuntimeString("VOX_INBOUND_NUMBER")),
  };
  return success({
    health: { configured: Object.values(checks).every(Boolean), checks },
    summary,
    intakes: rows.map((row) => ({
      status: row.status,
      reasonCode: row.reasonCode,
      agentVersion: row.agentVersion,
      receivedAt: row.receivedAt,
      processedAt: row.processedAt,
      publicId: row.publicId,
    })),
  });
}

async function ingestBlogPost(request: Request) {
  const body = await readJsonObject(request);
  const blogId = getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || "combaksa_repair";
  const post = normalizePublishedPostInput(body, blogId);
  await upsertPublishedBlogPost(post, "event");
  return success({ postId: post.postId });
}

async function ingestBlogRss(request: Request) {
  try {
    const body = await readJsonObject(request, MAX_RSS_BYTES);
    const configured = getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || "combaksa_repair";
    if (!Array.isArray(body.posts) || body.posts.length > 50) {
      throw new CoreHttpError("INVALID_REQUEST", 400, "RSS 입력을 확인해 주세요.");
    }
    const posts = body.posts.map((post) => {
      if (!isObject(post)) throw new CoreHttpError("INVALID_REQUEST", 400, "RSS 게시물 형식을 확인해 주세요.");
      return normalizePublishedPostInput(post, configured);
    });
    for (const post of posts) await upsertPublishedBlogPost(post, "rss");
    await recordBlogSyncSuccess();
    return success({ count: posts.length, blogId: configured });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS_SYNC_FAILED";
    await recordBlogSyncFailure(message).catch(() => undefined);
    throw error;
  }
}

async function reportBlogRssFailure(request: Request) {
  const body = await readJsonObject(request);
  const allowed = new Set([
    "FETCH_TIMEOUT",
    "HTTP_ERROR",
    "INVALID_CONTENT_TYPE",
    "PAYLOAD_TOO_LARGE",
    "PARSE_ERROR",
    "TRANSPORT_ERROR",
  ]);
  const code = typeof body.code === "string" ? body.code : "";
  if (!allowed.has(code)) {
    throw new CoreHttpError("INVALID_REQUEST", 400, "RSS 실패 코드를 확인해 주세요.");
  }
  await recordBlogSyncFailure(code);
  return success({ recorded: true });
}

async function route(request: Request, bindings: Env): Promise<Response> {
  if (getRuntimeString("NEW_CORE_ENABLED").toLowerCase() !== "true") {
    return failure("SERVICE_UNAVAILABLE", "신규 사이트 공용 서비스가 비활성 상태입니다.", 503);
  }
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  if (method === "GET" && path === "/v1/blog/posts") {
    return success({ posts: await listPublishedBlogPosts(parsePositiveInteger(url.searchParams.get("limit"), 3, 12)) });
  }
  if (method === "POST" && path === "/v1/requests") return createRequest(request);
  if (method === "POST" && path === "/v1/customer/session") return createCustomerSession(request);
  if (method === "GET" && path === "/v1/customer/requests") return customerRequests(request);
  const customerRequestMatch = /^\/v1\/customer\/requests\/([^/]+)$/.exec(path);
  if (customerRequestMatch && method === "GET") {
    return customerRequestDetail(request, decodeURIComponent(customerRequestMatch[1]));
  }
  const customerUnlockMatch = /^\/v1\/customer\/requests\/([^/]+)\/unlock$/.exec(path);
  if (customerUnlockMatch && method === "POST") {
    return unlockCustomerRequest(request, decodeURIComponent(customerUnlockMatch[1]));
  }
  if (method === "DELETE" && path === "/v1/customer/session") {
    await deleteCustomerLookupSession(cookie(request, NEW_SITE_CUSTOMER_LOOKUP_COOKIE), "new");
    return success({ authenticated: false }, 200, {
      "Set-Cookie": setCookie(NEW_SITE_CUSTOMER_LOOKUP_COOKIE, "", 0, "Lax"),
    });
  }
  if (method === "POST" && path === "/v1/admin/session") return createAdminSession(request);
  if (method === "GET" && path === "/v1/admin/setup") return adminSetupStatus();
  if (method === "POST" && path === "/v1/admin/setup") return createInitialAdmin(request);
  if (method === "GET" && path === "/v1/admin/session") {
    const user = await requireAdmin(request);
    return success({ user });
  }
  if (method === "DELETE" && path === "/v1/admin/session") {
    return success({ authenticated: false }, 200, {
      "Set-Cookie": setCookie(NEW_SITE_ADMIN_SESSION_COOKIE, "", 0, "Strict"),
    });
  }
  if (method === "GET" && path === "/v1/admin/requests") return listAdminRequests(request);
  const requestMatch = /^\/v1\/admin\/requests\/([^/]+)$/.exec(path);
  if (requestMatch && method === "GET") return adminRequestDetail(request, decodeURIComponent(requestMatch[1]));
  if (requestMatch && method === "PATCH") return patchAdminRequest(request, decodeURIComponent(requestMatch[1]));
  if (method === "GET" && path === "/v1/admin/staff") {
    const admin = await requireAdmin(request);
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    return success({ slots: await listStaffSlots(), assignmentOptions: await listAssignmentOptions() });
  }
  if (method === "POST" && path === "/v1/admin/staff") return mutateStaff(request);
  if (method === "POST" && path === "/v1/admin/password") return changeAdminPassword(request);
  if ((method === "GET" || method === "POST") && path === "/v1/admin/marketing/jobs") {
    return adminMarketingJobs(request, bindings);
  }
  if (method === "GET" && path === "/v1/admin/integrations/vox") return adminVoxStatus(request);
  if (method === "GET" && path === "/v1/admin/settlements") return settlements(request);
  if (method === "GET" && path === "/v1/admin/blog/posts") {
    const admin = await requireAdmin(request);
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    return success({ posts: await listAllBlogPosts(100), syncState: await getBlogSyncState() });
  }
  const blogMatch = /^\/v1\/admin\/blog\/posts\/([^/]+)$/.exec(path);
  if (blogMatch && method === "PATCH") {
    const admin = await requireAdmin(request);
    if (admin.role !== "OWNER") throw new CoreHttpError("FORBIDDEN", 403, "운영자 권한이 필요합니다.");
    const body = await readJsonObject(request);
    if (body.visibility !== "PUBLISHED" && body.visibility !== "HIDDEN") {
      throw new CoreHttpError("INVALID_REQUEST", 400, "공개 상태를 확인해 주세요.");
    }
    if (!(await setBlogPostVisibility(decodeURIComponent(blogMatch[1]), body.visibility))) {
      throw new CoreHttpError("NOT_FOUND", 404, "게시글을 찾을 수 없습니다.");
    }
    return success({ updated: true });
  }
  if (method === "POST" && path === "/v1/blog/posts") return ingestBlogPost(request);
  if (method === "POST" && path === "/v1/blog/rss") return ingestBlogRss(request);
  if (method === "POST" && path === "/v1/blog/rss/status") return reportBlogRssFailure(request);
  if (method === "POST" && path === "/v1/vox") {
    if (getRuntimeString("NEW_SITE_VOX_PROCESSING_ENABLED").toLowerCase() !== "true") {
      return failure("SERVICE_UNAVAILABLE", "Vox 내부 처리가 비활성 상태입니다.", 503);
    }
    return handleVoxWebhook(request, "new");
  }
  return failure("NOT_FOUND", "경로를 찾을 수 없습니다.", 404);
}

export class NewSiteCore extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    try {
      return await route(request, this.env);
    } catch (error) {
      if (error instanceof CoreHttpError) return failure(error.code, error.message, error.status);
      if (error instanceof RequestValidationError) return failure("INVALID_REQUEST", error.message, 400, error.fields);
      if (error instanceof CustomerLookupError) {
        return error.code === "BLOCKED"
          ? failure("RATE_LIMITED", "입력 횟수를 초과했습니다.", 429)
          : failure("AUTH_REQUIRED", "입력 정보를 확인해 주세요.", 401);
      }
      if (error instanceof AdminRecordAuthorizationError) return failure("FORBIDDEN", error.message, 403);
      if (error instanceof AdminRecordValidationError) return failure("INVALID_REQUEST", error.message, 400, error.fields);
      if (error instanceof MarketingJobSubmissionError) {
        return failure(
          error.code,
          error.message,
          error.status,
          error.jobId ? { jobId: error.jobId } : undefined,
        );
      }
      const code = error instanceof Error ? error.message : "UNKNOWN";
      if (code === "IDEMPOTENCY_CONFLICT") return failure(code, "멱등 키가 다른 요청에 사용되었습니다.", 409);
      if (code === "ASSIGNMENT_CONFLICT") return failure(code, "담당자가 이미 변경되었습니다.", 409);
      if (code === "INVALID_TRANSITION") return failure(code, "현재 상태에서 변경할 수 없습니다.", 400);
      console.error(JSON.stringify({ message: "NewSiteCore request failed", error: code.slice(0, 160) }));
      return failure("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
    }
  }
}

import type {
  PublicRequestSummary,
  RequestStatus,
  ServiceRequestRecord,
  StatusHistoryRecord,
} from "@/lib/domain";
import { ensureDatabase, getD1 } from "./database";

type RequestRow = {
  id: string;
  public_id: string;
  name: string;
  phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  region_public: string;
  device_type: ServiceRequestRecord["deviceType"];
  manufacturer_model: string;
  symptom: string;
  description: string;
  visibility: ServiceRequestRecord["visibility"];
  access_password_hash: string | null;
  status: RequestStatus;
  preferred_at: string | null;
  internal_note: string;
  notification_status: string;
  notification_error: string | null;
  created_at: string;
  updated_at: string;
};

type OutboxRow = {
  id: string;
  request_id: string;
  attempts: number;
};

function mapRequest(row: RequestRow): ServiceRequestRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    phone: row.phone,
    postalCode: row.postal_code,
    address1: row.address1,
    address2: row.address2,
    regionPublic: row.region_public,
    deviceType: row.device_type,
    manufacturerModel: row.manufacturer_model,
    symptom: row.symptom,
    description: row.description,
    visibility: row.visibility,
    accessPasswordHash: row.access_password_hash,
    status: row.status,
    preferredAt: row.preferred_at,
    internalNote: row.internal_note,
    notificationStatus: row.notification_status,
    notificationError: row.notification_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertRequest(
  request: ServiceRequestRecord & {
    privacyConsentVersion: string;
    privacyConsentedAt: string;
  },
) {
  await ensureDatabase();
  const db = getD1();
  const now = request.createdAt;
  const outboxId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(`
        INSERT INTO service_requests (
          id, public_id, name, phone, postal_code, address1, address2, region_public,
          device_type, manufacturer_model, symptom, description, visibility,
          access_password_hash, status, preferred_at, internal_note,
          notification_status, privacy_consent_version, privacy_consented_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'PENDING', ?, ?, ?, ?)
      `)
      .bind(
        request.id,
        request.publicId,
        request.name,
        request.phone,
        request.postalCode,
        request.address1,
        request.address2,
        request.regionPublic,
        request.deviceType,
        request.manufacturerModel,
        request.symptom,
        request.description,
        request.visibility,
        request.accessPasswordHash,
        request.status,
        request.preferredAt,
        request.privacyConsentVersion,
        request.privacyConsentedAt,
        now,
        now,
      ),
    db
      .prepare(`
        INSERT INTO request_status_history
          (id, request_id, status, public_note, changed_by, created_at)
        VALUES (?, ?, 'RECEIVED', '서비스 신청이 정상적으로 접수되었습니다.', 'SYSTEM', ?)
      `)
      .bind(crypto.randomUUID(), request.id, now),
    db
      .prepare(`
        INSERT INTO notification_outbox
          (id, request_id, channel, status, attempts, next_attempt_at, created_at, updated_at)
        VALUES (?, ?, 'TELEGRAM', 'PENDING', 0, ?, ?, ?)
      `)
      .bind(outboxId, request.id, now, now, now),
  ]);
}

export async function findRequestByPublicId(publicId: string) {
  await ensureDatabase();
  const row = await getD1()
    .prepare("SELECT * FROM service_requests WHERE public_id = ? AND deleted_at IS NULL")
    .bind(publicId)
    .first<RequestRow>();
  return row ? mapRequest(row) : null;
}

export async function listStatusHistory(requestId: string) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT id, request_id, status, public_note, changed_by, created_at
      FROM request_status_history
      WHERE request_id = ?
      ORDER BY created_at DESC
    `)
    .bind(requestId)
    .all<{
      id: string;
      request_id: string;
      status: RequestStatus;
      public_note: string;
      changed_by: string;
      created_at: string;
    }>();
  return result.results.map<StatusHistoryRecord>((row) => ({
    id: row.id,
    requestId: row.request_id,
    status: row.status,
    publicNote: row.public_note,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  }));
}

export async function listPublicRequests(search = "", status = "", limit = 20) {
  await ensureDatabase();
  const clauses = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  if (search) {
    clauses.push("(public_id LIKE ? OR device_type LIKE ? OR symptom LIKE ?)");
    const pattern = `%${search}%`;
    values.push(pattern, pattern, pattern);
  }
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  values.push(limit);
  const result = await getD1()
    .prepare(`
      SELECT public_id, name, region_public, device_type, symptom, visibility, status, created_at
      FROM service_requests
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(...values)
    .all<{
      public_id: string;
      name: string;
      region_public: string;
      device_type: PublicRequestSummary["deviceType"];
      symptom: string;
      visibility: PublicRequestSummary["visibility"];
      status: PublicRequestSummary["status"];
      created_at: string;
    }>();
  return result.results;
}

export async function listAdminRequests(search = "", status = "", limit = 100) {
  await ensureDatabase();
  const clauses = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  if (search) {
    clauses.push(
      "(public_id LIKE ? OR name LIKE ? OR phone LIKE ? OR address1 LIKE ? OR device_type LIKE ? OR symptom LIKE ?)",
    );
    const pattern = `%${search}%`;
    values.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  values.push(limit);
  const result = await getD1()
    .prepare(`
      SELECT * FROM service_requests
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(...values)
    .all<RequestRow>();
  return result.results.map(mapRequest);
}

export async function requestStats() {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT status, COUNT(*) AS count
      FROM service_requests
      WHERE deleted_at IS NULL
      GROUP BY status
    `)
    .all<{ status: RequestStatus; count: number }>();
  return Object.fromEntries(result.results.map((row) => [row.status, Number(row.count)]));
}

export async function updateRequestStatus(
  request: ServiceRequestRecord,
  status: RequestStatus,
  publicNote: string,
  internalNote: string,
  changedBy: string,
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(`
        UPDATE service_requests
        SET status = ?, internal_note = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .bind(status, internalNote, now, request.id),
    getD1()
      .prepare(`
        INSERT INTO request_status_history
          (id, request_id, status, public_note, changed_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(crypto.randomUUID(), request.id, status, publicNote, changedBy, now),
  ]);
}

export async function pendingNotifications(limit = 3) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT id, request_id, attempts
      FROM notification_outbox
      WHERE status IN ('PENDING', 'FAILED', 'CONFIG_REQUIRED')
        AND attempts < 5
        AND next_attempt_at <= ?
      ORDER BY created_at ASC
      LIMIT ?
    `)
    .bind(new Date().toISOString(), limit)
    .all<OutboxRow>();
  return result.results;
}

export async function markNotification(
  outbox: OutboxRow,
  status: "SENT" | "FAILED" | "CONFIG_REQUIRED",
  error?: string,
) {
  const now = new Date();
  const delays = [60, 300, 1800, 7200, 21600];
  const next = new Date(now.getTime() + delays[Math.min(outbox.attempts, delays.length - 1)] * 1000);
  await getD1().batch([
    getD1()
      .prepare(`
        UPDATE notification_outbox
        SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ?,
            sent_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        status,
        outbox.attempts + (status === "CONFIG_REQUIRED" ? 0 : 1),
        next.toISOString(),
        error?.slice(0, 240) ?? null,
        status === "SENT" ? now.toISOString() : null,
        now.toISOString(),
        outbox.id,
      ),
    getD1()
      .prepare(`
        UPDATE service_requests
        SET notification_status = ?, notification_error = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(status, error?.slice(0, 240) ?? null, now.toISOString(), outbox.request_id),
  ]);
}

export async function getRequestById(id: string) {
  await ensureDatabase();
  const row = await getD1()
    .prepare("SELECT * FROM service_requests WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<RequestRow>();
  return row ? mapRequest(row) : null;
}

export async function resetNotification(publicId: string) {
  await ensureDatabase();
  const request = await findRequestByPublicId(publicId);
  if (!request) return false;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(`
        UPDATE notification_outbox
        SET status = 'PENDING', attempts = 0, next_attempt_at = ?, last_error = NULL, updated_at = ?
        WHERE request_id = ?
      `)
      .bind(now, now, request.id),
    getD1()
      .prepare(`
        UPDATE service_requests
        SET notification_status = 'PENDING', notification_error = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, request.id),
  ]);
  return true;
}

export async function getAccessAttempt(key: string) {
  await ensureDatabase();
  return getD1()
    .prepare("SELECT failures, blocked_until FROM access_attempts WHERE key = ?")
    .bind(key)
    .first<{ failures: number; blocked_until: string | null }>();
}

export async function recordAccessFailure(key: string, currentFailures: number) {
  const now = new Date();
  const failures = currentFailures + 1;
  const blockedUntil =
    failures >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
  await getD1()
    .prepare(`
      INSERT INTO access_attempts (key, failures, blocked_until, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        failures = excluded.failures,
        blocked_until = excluded.blocked_until,
        updated_at = excluded.updated_at
    `)
    .bind(key, failures, blockedUntil, now.toISOString())
    .run();
}

export async function clearAccessFailures(key: string) {
  await ensureDatabase();
  await getD1().prepare("DELETE FROM access_attempts WHERE key = ?").bind(key).run();
}

export async function anonymizeRequest(publicId: string, changedBy: string) {
  await ensureDatabase();
  const request = await findRequestByPublicId(publicId);
  if (!request) return false;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(`
        UPDATE service_requests
        SET name = '삭제된 신청자', phone = '', postal_code = '', address1 = '',
            address2 = '', region_public = '삭제됨', manufacturer_model = '',
            symptom = '삭제된 신청', description = '[개인정보 삭제 완료]',
            access_password_hash = NULL, internal_note = '', deleted_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, now, request.id),
    getD1()
      .prepare("UPDATE request_status_history SET public_note = '' WHERE request_id = ?")
      .bind(request.id),
    getD1()
      .prepare(`
        INSERT INTO request_status_history
          (id, request_id, status, public_note, changed_by, created_at)
        VALUES (?, ?, ?, '', ?, ?)
      `)
      .bind(crypto.randomUUID(), request.id, request.status, changedBy, now),
  ]);
  return true;
}

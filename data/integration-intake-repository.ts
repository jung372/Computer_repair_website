import type { StoredServiceRequest } from "@/data/request-repository";
import { ensureDatabase, getD1 } from "@/data/database";

export type VoxIntakeIdentity = {
  intakeId: string;
  externalId: string;
  eventType: "call_analyzed";
  payloadHash: string;
  agentId: string;
  agentVersion: string;
  receivedAt: string;
};

export type VoxIntegrationIntakeRow = {
  id: string;
  externalId: string;
  status: "CREATED" | "SKIPPED" | string;
  reasonCode: string | null;
  agentVersion: string | null;
  receivedAt: string;
  processedAt: string | null;
  publicId: string | null;
};

export type VoxIntegrationSummary = {
  total: number;
  created: number;
  skipped: number;
  latestReceivedAt: string | null;
};

type VoxIntegrationIntakeDatabaseRow = {
  id: string;
  external_id: string;
  status: string;
  reason_code: string | null;
  agent_version: string | null;
  received_at: string;
  processed_at: string | null;
  public_id: string | null;
};

export async function listVoxIntegrationIntakes(limit = 50) {
  await ensureDatabase();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const result = await getD1()
    .prepare(`
      SELECT
        intake.id,
        intake.external_id,
        intake.status,
        intake.reason_code,
        intake.agent_version,
        intake.received_at,
        intake.processed_at,
        requests.public_id
      FROM integration_intakes intake
      LEFT JOIN service_requests requests ON requests.id = intake.request_id
      WHERE intake.provider = 'VOX'
      ORDER BY intake.received_at DESC, intake.id DESC
      LIMIT ?
    `)
    .bind(safeLimit)
    .all<VoxIntegrationIntakeDatabaseRow>();

  return result.results.map((row): VoxIntegrationIntakeRow => ({
    id: row.id,
    externalId: row.external_id,
    status: row.status,
    reasonCode: row.reason_code,
    agentVersion: row.agent_version,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    publicId: row.public_id,
  }));
}

export async function getVoxIntegrationSummary(): Promise<VoxIntegrationSummary> {
  await ensureDatabase();
  const row = await getD1()
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'CREATED' THEN 1 ELSE 0 END) AS created,
        SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped,
        MAX(received_at) AS latest_received_at
      FROM integration_intakes
      WHERE provider = 'VOX'
        AND received_at >= datetime('now', '-30 days')
    `)
    .first<{
      total: number;
      created: number | null;
      skipped: number | null;
      latest_received_at: string | null;
    }>();

  return {
    total: Number(row?.total ?? 0),
    created: Number(row?.created ?? 0),
    skipped: Number(row?.skipped ?? 0),
    latestReceivedAt: row?.latest_received_at ?? null,
  };
}

export async function recordSkippedVoxIntake(
  identity: VoxIntakeIdentity,
  reasonCode: string,
) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      INSERT OR IGNORE INTO integration_intakes (
        id, provider, external_id, event_type, request_id, status, reason_code,
        payload_hash, agent_id, agent_version, received_at, processed_at,
        created_at, updated_at
      ) VALUES (?, 'VOX', ?, ?, NULL, 'SKIPPED', ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      identity.intakeId,
      identity.externalId,
      identity.eventType,
      reasonCode,
      identity.payloadHash,
      identity.agentId,
      identity.agentVersion,
      identity.receivedAt,
      identity.receivedAt,
      identity.receivedAt,
      identity.receivedAt,
    )
    .run();
  return { created: result.meta.changes === 1 };
}

export async function insertVoxRequest(
  request: StoredServiceRequest,
  identity: VoxIntakeIdentity & {
    statusHistoryId: string;
    outboxId: string;
  },
) {
  await ensureDatabase();
  const db = getD1();
  const now = request.createdAt;
  const guard = [identity.intakeId, identity.payloadHash] as const;
  const results = await db.batch([
    db
      .prepare(`
        INSERT OR IGNORE INTO integration_intakes (
          id, provider, external_id, event_type, request_id, status, reason_code,
          payload_hash, agent_id, agent_version, received_at, processed_at,
          created_at, updated_at
        ) VALUES (?, 'VOX', ?, ?, NULL, 'CREATED', NULL, ?, ?, ?, ?, NULL, ?, ?)
      `)
      .bind(
        identity.intakeId,
        identity.externalId,
        identity.eventType,
        identity.payloadHash,
        identity.agentId,
        identity.agentVersion,
        identity.receivedAt,
        identity.receivedAt,
        identity.receivedAt,
      ),
    db
      .prepare(`
        INSERT OR IGNORE INTO service_requests (
          id, public_id, name, phone, postal_code, address1, address2, region_public,
          device_type, manufacturer_model, symptom, description, visibility,
          access_password_hash, lookup_key, status, preferred_at, internal_note,
          notification_status, privacy_consent_version, privacy_consented_at,
          privacy_legal_basis, privacy_notice_version, privacy_notice_presented_at,
          created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM integration_intakes
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
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
        request.lookupKey,
        request.status,
        request.preferredAt,
        request.internalNote,
        request.notificationStatus,
        request.privacyConsentVersion,
        request.privacyConsentedAt,
        request.privacyLegalBasis,
        request.privacyNoticeVersion,
        request.privacyNoticePresentedAt,
        now,
        now,
        ...guard,
      ),
    db
      .prepare(`
        INSERT OR IGNORE INTO request_status_history
          (id, request_id, status, public_note, changed_by, created_at)
        SELECT ?, ?, 'RECEIVED', '서비스 신청이 정상적으로 접수되었습니다.', 'VOX_WEBHOOK', ?
        FROM integration_intakes
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
      `)
      .bind(identity.statusHistoryId, request.id, now, ...guard),
    db
      .prepare(`
        INSERT OR IGNORE INTO request_serials (request_id)
        SELECT ? FROM integration_intakes
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
      `)
      .bind(request.id, ...guard),
    db
      .prepare(`
        INSERT OR IGNORE INTO request_operations (
          request_id, receipt_type, customer_type, title, received_date, updated_at
        )
        SELECT ?, '콜센터접수', '신규일반고객', ?, ?, ?
        FROM integration_intakes
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
      `)
      .bind(request.id, request.symptom || "수리요청", now.slice(0, 10), now, ...guard),
    db
      .prepare(`
        INSERT OR IGNORE INTO notification_outbox (
          id, request_id, channel, status, attempts, next_attempt_at, created_at, updated_at
        )
        SELECT ?, ?, 'TELEGRAM', ?, 0, ?, ?, ?
        FROM integration_intakes
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
      `)
      .bind(
        identity.outboxId,
        request.id,
        request.notificationStatus,
        now,
        now,
        now,
        ...guard,
      ),
    db
      .prepare(`
        UPDATE integration_intakes
        SET request_id = ?, processed_at = ?, updated_at = ?
        WHERE id = ? AND payload_hash = ? AND status = 'CREATED'
      `)
      .bind(request.id, now, now, ...guard),
  ]);

  const intake = await db
    .prepare(`
      SELECT status, payload_hash, request_id
      FROM integration_intakes
      WHERE provider = 'VOX' AND external_id = ? AND event_type = ?
    `)
    .bind(identity.externalId, identity.eventType)
    .first<{ status: string; payload_hash: string | null; request_id: string | null }>();
  if (!intake) throw new Error("VOX_INTAKE_NOT_PERSISTED");
  if (
    intake.payload_hash !== identity.payloadHash ||
    intake.status !== "CREATED" ||
    intake.request_id !== request.id
  ) {
    return { created: false, duplicate: true, payloadMismatch: intake.payload_hash !== identity.payloadHash };
  }

  const verification = await db
    .prepare(`
      SELECT
        EXISTS(SELECT 1 FROM service_requests WHERE id = ?) AS request_exists,
        EXISTS(SELECT 1 FROM request_status_history WHERE id = ?) AS history_exists,
        EXISTS(SELECT 1 FROM request_operations WHERE request_id = ?) AS operation_exists,
        EXISTS(SELECT 1 FROM notification_outbox WHERE id = ?) AS outbox_exists
    `)
    .bind(request.id, identity.statusHistoryId, request.id, identity.outboxId)
    .first<{
      request_exists: number;
      history_exists: number;
      operation_exists: number;
      outbox_exists: number;
    }>();
  if (
    !verification ||
    !verification.request_exists ||
    !verification.history_exists ||
    !verification.operation_exists ||
    !verification.outbox_exists
  ) {
    throw new Error("VOX_REQUEST_BATCH_INCOMPLETE");
  }

  return {
    created: results[0]?.meta.changes === 1,
    duplicate: results[0]?.meta.changes !== 1,
    payloadMismatch: false,
  };
}

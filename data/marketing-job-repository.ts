import { ensureDatabase, getD1 } from "@/data/database";

export type MarketingJobInput = {
  symptom: string;
  causeUnknown: boolean;
  diagnosedCause: string;
  actionsTaken: string;
  verificationResult: string;
  deviceInfo: string;
  workDuration: string;
  repairNotes: string;
  district: string;
  photoConsent: boolean;
  privacyReviewed: boolean;
  photoEvidenceNote: string;
};

export type MarketingAsset = {
  id: string;
  jobId: string;
  sequence: number;
  r2Key: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
};

export type MarketingJobRow = MarketingJobInput & {
  id: string;
  schemaVersion: number;
  status: string;
  requestedBy: string;
  idempotencyKey: string;
  localJobId: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type RawJob = {
  id: string; schema_version: number; status: string; symptom: string; cause_unknown: number;
  diagnosed_cause: string; actions_taken: string; verification_result: string; device_info: string;
  work_duration: string; repair_notes: string; district: string; photo_consent: number;
  privacy_reviewed: number; photo_evidence_note: string; requested_by: string; idempotency_key: string;
  local_job_id: string | null; failure_code: string | null; created_at: string; updated_at: string;
};

function mapJob(row: RawJob): MarketingJobRow {
  return {
    id: row.id,
    schemaVersion: Number(row.schema_version),
    status: row.status,
    symptom: row.symptom,
    causeUnknown: row.cause_unknown === 1,
    diagnosedCause: row.diagnosed_cause,
    actionsTaken: row.actions_taken,
    verificationResult: row.verification_result,
    deviceInfo: row.device_info,
    workDuration: row.work_duration,
    repairNotes: row.repair_notes,
    district: row.district,
    photoConsent: row.photo_consent === 1,
    privacyReviewed: row.privacy_reviewed === 1,
    photoEvidenceNote: row.photo_evidence_note,
    requestedBy: row.requested_by,
    idempotencyKey: row.idempotency_key,
    localJobId: row.local_job_id,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMarketingJob(input: MarketingJobInput & {
  id: string; requestedBy: string; idempotencyKey: string; now: string;
}) {
  await ensureDatabase();
  const db = getD1();
  await db.batch([
    db.prepare(`INSERT INTO marketing_jobs (
      id, schema_version, status, symptom, cause_unknown, diagnosed_cause, actions_taken,
      verification_result, device_info, work_duration, repair_notes, district, photo_consent,
      privacy_reviewed, photo_evidence_note, requested_by, idempotency_key, created_at, updated_at
    ) VALUES (?, 1, 'UPLOADING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.id, input.symptom, input.causeUnknown ? 1 : 0, input.diagnosedCause,
        input.actionsTaken, input.verificationResult, input.deviceInfo, input.workDuration,
        input.repairNotes, input.district, input.photoConsent ? 1 : 0,
        input.privacyReviewed ? 1 : 0, input.photoEvidenceNote, input.requestedBy,
        input.idempotencyKey, input.now, input.now),
    db.prepare(`INSERT INTO marketing_job_events
      (id, job_id, status, actor, message, created_at)
      VALUES (?, ?, 'UPLOADING', ?, '입력 원장 저장을 마치고 사진 보호 처리를 시작했습니다.', ?)`)
      .bind(`marketing_event_${crypto.randomUUID()}`, input.id, input.requestedBy, input.now),
    db.prepare(`INSERT INTO admin_audit_logs (id, admin_id, event_type, metadata, created_at)
      VALUES (?, ?, 'MARKETING_JOB_CREATED', ?, ?)`)
      .bind(`audit_${crypto.randomUUID()}`, input.requestedBy, JSON.stringify({ jobId: input.id }), input.now),
  ]);
}

export async function addMarketingAsset(asset: MarketingAsset, now: string) {
  await getD1().prepare(`INSERT INTO marketing_job_assets
    (id, job_id, sequence, r2_key, original_name, mime_type, size, sha256, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(asset.id, asset.jobId, asset.sequence, asset.r2Key, asset.originalName,
      asset.mimeType, asset.size, asset.sha256, now).run();
}

export async function recordMarketingJobStatus(
  jobId: string,
  status: string,
  actor: string,
  message: string,
  options: { localJobId?: string; failureCode?: string; metadata?: unknown } = {},
) {
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db.prepare(`UPDATE marketing_jobs SET status = ?, local_job_id = COALESCE(?, local_job_id),
      failure_code = ?, updated_at = ? WHERE id = ?`)
      .bind(status, options.localJobId || null, options.failureCode || null, now, jobId),
    db.prepare(`INSERT INTO marketing_job_events
      (id, job_id, status, actor, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`marketing_event_${crypto.randomUUID()}`, jobId, status, actor, message,
        options.metadata ? JSON.stringify(options.metadata) : null, now),
  ]);
}

export async function getMarketingJob(jobId: string) {
  await ensureDatabase();
  const row = await getD1().prepare("SELECT * FROM marketing_jobs WHERE id = ?")
    .bind(jobId).first<RawJob>();
  if (!row) return null;
  const assets = await getD1().prepare(`SELECT id, job_id, sequence, r2_key, original_name,
    mime_type, size, sha256 FROM marketing_job_assets WHERE job_id = ? ORDER BY sequence`)
    .bind(jobId).all<{ id: string; job_id: string; sequence: number; r2_key: string; original_name: string; mime_type: string; size: number; sha256: string }>();
  return {
    ...mapJob(row),
    assets: assets.results.map((asset) => ({
      id: asset.id, jobId: asset.job_id, sequence: asset.sequence, r2Key: asset.r2_key,
      originalName: asset.original_name, mimeType: asset.mime_type, size: asset.size, sha256: asset.sha256,
    })),
  };
}

// D1 batch is transactional. A source timestamp orders retries and prevents stale delivery.
export const BRIDGE_EVENT_SQL = `INSERT INTO marketing_job_events
  (id, job_id, status, actor, message, metadata, created_at)
  SELECT ?, id, ?, 'local-bridge', ?, ?, ? FROM marketing_jobs
  WHERE id = ? AND (local_job_id IS NULL OR local_job_id = ?)
  AND NOT EXISTS (SELECT 1 FROM marketing_job_events e WHERE e.job_id = marketing_jobs.id
    AND e.actor = 'local-bridge' AND COALESCE(json_extract(e.metadata, '$.sourceUpdatedAt'), '') > ?)
  AND (status <> ? OR local_job_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM marketing_job_events e WHERE e.job_id = marketing_jobs.id
    AND e.actor = 'local-bridge' AND COALESCE(json_extract(e.metadata, '$.sourceUpdatedAt'), '') = ?))`;

export const BRIDGE_STATUS_SQL = `UPDATE marketing_jobs
  SET status = ?, local_job_id = ?, failure_code = ?, updated_at = ?
  WHERE id = ? AND (local_job_id IS NULL OR local_job_id = ?)
  AND NOT EXISTS (SELECT 1 FROM marketing_job_events e WHERE e.job_id = marketing_jobs.id
    AND e.actor = 'local-bridge' AND COALESCE(json_extract(e.metadata, '$.sourceUpdatedAt'), '') > ?)`;

export async function recordBridgeMarketingJobStatus(jobId: string, status: string, message: string,
  options: { localJobId: string; sourceUpdatedAt: string; failureCode?: string }) {
  const now = new Date().toISOString();
  const { localJobId, sourceUpdatedAt } = options;
  const db = getD1();
  await db.batch([
    db.prepare(BRIDGE_EVENT_SQL).bind(`marketing_event_${crypto.randomUUID()}`, status, message,
      JSON.stringify({ sourceUpdatedAt }), now, jobId, localJobId, sourceUpdatedAt, status, sourceUpdatedAt),
    db.prepare(BRIDGE_STATUS_SQL).bind(status, localJobId, options.failureCode || null, now,
      jobId, localJobId, sourceUpdatedAt),
  ]);
}

export async function listMarketingJobs(limit = 50) {
  await ensureDatabase();
  const rows = await getD1().prepare("SELECT * FROM marketing_jobs ORDER BY created_at DESC LIMIT ?")
    .bind(Math.max(1, Math.min(100, Math.trunc(limit)))).all<RawJob>();
  return rows.results.map(mapJob);
}

export async function getNextQueuedMarketingJob() {
  await ensureDatabase();
  const row = await getD1().prepare(`SELECT * FROM marketing_jobs
    WHERE status IN ('QUEUED', 'QUEUE_NOTIFIED') ORDER BY created_at ASC LIMIT 1`)
    .first<RawJob>();
  return row ? mapJob(row) : null;
}

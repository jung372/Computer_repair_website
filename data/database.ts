import { env } from "cloudflare:workers";

let schemaPromise: Promise<void> | null = null;

export function getD1(): D1Database {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error("D1 binding DB is unavailable");
  return database;
}

export function ensureDatabase() {
  if (!schemaPromise) schemaPromise = initializeDatabase();
  return schemaPromise;
}

async function initializeDatabase() {
  const db = getD1();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        address1 TEXT NOT NULL,
        address2 TEXT NOT NULL,
        region_public TEXT NOT NULL,
        device_type TEXT NOT NULL,
        manufacturer_model TEXT NOT NULL DEFAULT '',
        symptom TEXT NOT NULL,
        description TEXT NOT NULL,
        visibility TEXT NOT NULL,
        access_password_hash TEXT,
        status TEXT NOT NULL DEFAULT 'RECEIVED',
        preferred_at TEXT,
        internal_note TEXT NOT NULL DEFAULT '',
        notification_status TEXT NOT NULL DEFAULT 'PENDING',
        notification_error TEXT,
        privacy_consent_version TEXT NOT NULL,
        privacy_consented_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS request_status_history (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL,
        public_note TEXT NOT NULL DEFAULT '',
        changed_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES service_requests(id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notification_outbox (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'TELEGRAM',
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL,
        last_error TEXT,
        sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES service_requests(id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS access_attempts (
        key TEXT PRIMARY KEY,
        failures INTEGER NOT NULL DEFAULT 0,
        blocked_until TEXT,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS service_requests_created_idx ON service_requests(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_history_request_idx ON request_status_history(request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON notification_outbox(status)"),
  ]);
}

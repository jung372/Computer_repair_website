import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  const database = env.DB;
  if (!database) throw new Error("D1 binding DB is unavailable");
  return database;
}

export async function ensureDatabase() {
  if (process.env.NODE_ENV !== "production") {
    await initializeDatabase();
  }
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
        lookup_key TEXT,
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
        event_type TEXT NOT NULL DEFAULT 'NEW_REQUEST',
        recipient_account_id TEXT,
        telegram_message_id TEXT,
        canceled_at TEXT,
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
    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_lookup_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_lookup_session_requests (
        session_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (session_id, request_id),
        FOREIGN KEY (session_id) REFERENCES customer_lookup_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS security_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        login_name TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'STAFF',
        created_by TEXT,
        slot_serial_no INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        session_version INTEGER NOT NULL DEFAULT 1,
        password_changed_at TEXT NOT NULL,
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS staff_slots (
        serial_no INTEGER PRIMARY KEY CHECK (serial_no BETWEEN 1 AND 3),
        label TEXT NOT NULL,
        telegram_chat_id_ciphertext TEXT,
        telegram_chat_id_iv TEXT,
        telegram_enabled INTEGER NOT NULL DEFAULT 0,
        telegram_verified_at TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT,
        event_type TEXT NOT NULL,
        client_hash TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS request_assignment_history (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        previous_account_id TEXT,
        assigned_account_id TEXT,
        assignee_name_snapshot TEXT NOT NULL DEFAULT '',
        event_type TEXT NOT NULL,
        reason TEXT,
        changed_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS request_serials (
        serial_no INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS request_operations (
        request_id TEXT PRIMARY KEY,
        receipt_type TEXT NOT NULL DEFAULT '온라인접수',
        assignee TEXT NOT NULL DEFAULT '',
        assignee_phone TEXT NOT NULL DEFAULT '',
        assignee_account_id TEXT,
        assigned_by TEXT,
        assigned_at TEXT,
        customer_type TEXT NOT NULL DEFAULT '신규일반고객',
        landline TEXT NOT NULL DEFAULT '',
        invoice_date TEXT,
        invoice_content TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '수리요청',
        request_category TEXT NOT NULL DEFAULT '',
        received_date TEXT NOT NULL,
        visit_timing TEXT NOT NULL DEFAULT '협의',
        visit_date TEXT,
        completed_date TEXT,
        payment_method TEXT NOT NULL DEFAULT '',
        total_amount INTEGER NOT NULL DEFAULT 0,
        material_cost INTEGER NOT NULL DEFAULT 0,
        vat_amount INTEGER NOT NULL DEFAULT 0,
        material_vat_amount INTEGER NOT NULL DEFAULT 0,
        technician_income INTEGER NOT NULL DEFAULT 0,
        office_deposit INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS service_requests_created_idx ON service_requests(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_history_request_idx ON request_status_history(request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON notification_outbox(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS customer_lookup_request_idx ON customer_lookup_session_requests(request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_operations_receipt_idx ON request_operations(receipt_type)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_operations_assignee_idx ON request_operations(assignee)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_operations_dates_idx ON request_operations(received_date, completed_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_assignment_history_request_idx ON request_assignment_history(request_id)"),
  ]);

  await db.batch([
    db.prepare(`
      INSERT INTO request_serials (request_id)
      SELECT requests.id
      FROM service_requests requests
      LEFT JOIN request_serials serial ON serial.request_id = requests.id
      WHERE serial.request_id IS NULL
      ORDER BY requests.created_at ASC, requests.id ASC
    `),
    db.prepare(`
      INSERT OR IGNORE INTO request_operations (
        request_id, receipt_type, customer_type, title, received_date, updated_at
      )
      SELECT
        id, '온라인접수', '신규일반고객',
        CASE WHEN symptom = '' THEN '수리요청' ELSE symptom END,
        substr(created_at, 1, 10), updated_at
      FROM service_requests
    `),
    db.prepare(`
      INSERT OR IGNORE INTO staff_slots (serial_no, label, created_at, updated_at)
      VALUES
        (1, '직원 슬롯 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        (2, '직원 슬롯 2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        (3, '직원 슬롯 3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `),
  ]);

  const columns = await db.prepare("PRAGMA table_info(service_requests)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "lookup_key")) {
    await db.prepare("ALTER TABLE service_requests ADD COLUMN lookup_key TEXT").run();
  }
  const operationColumns = await db
    .prepare("PRAGMA table_info(request_operations)")
    .all<{ name: string }>();
  if (!operationColumns.results.some((column) => column.name === "visit_timing")) {
    await db
      .prepare(
        "ALTER TABLE request_operations ADD COLUMN visit_timing TEXT NOT NULL DEFAULT '협의'",
      )
      .run();
  }
  if (!operationColumns.results.some((column) => column.name === "material_vat_amount")) {
    await db
      .prepare(
        "ALTER TABLE request_operations ADD COLUMN material_vat_amount INTEGER NOT NULL DEFAULT 0",
      )
      .run();
    await db.batch([
      db.prepare(`
        UPDATE request_operations
        SET payment_method = CASE payment_method
              WHEN '현금결제' THEN '현금 결제'
              WHEN '카드결제' THEN '카드 결제'
              ELSE payment_method
            END,
            material_vat_amount = CAST(ROUND(material_cost / 10.0) AS INTEGER)
      `),
      db.prepare(`
        UPDATE request_operations
        SET vat_amount = CASE payment_method
              WHEN '현금 결제' THEN 0
              WHEN '현금영수증 결제' THEN CAST(ROUND(total_amount / 11.0) AS INTEGER)
              WHEN '카드 결제' THEN CAST(ROUND(total_amount / 11.0) AS INTEGER)
              ELSE vat_amount
            END
      `),
      db.prepare(`
        UPDATE request_operations
        SET technician_income = MAX(
          0,
          total_amount - vat_amount - material_cost - material_vat_amount
        )
        WHERE payment_method IN ('현금 결제', '현금영수증 결제', '카드 결제')
      `),
    ]);
  }
  if (!operationColumns.results.some((column) => column.name === "assignee_account_id")) {
    await db.batch([
      db.prepare("ALTER TABLE request_operations ADD COLUMN assignee_account_id TEXT"),
      db.prepare("ALTER TABLE request_operations ADD COLUMN assigned_by TEXT"),
      db.prepare("ALTER TABLE request_operations ADD COLUMN assigned_at TEXT"),
    ]);
  }
  const adminColumns = await db
    .prepare("PRAGMA table_info(admins)")
    .all<{ name: string }>();
  if (!adminColumns.results.some((column) => column.name === "display_name")) {
    await db.batch([
      db.prepare("ALTER TABLE admins ADD COLUMN display_name TEXT NOT NULL DEFAULT ''"),
      db.prepare("ALTER TABLE admins ADD COLUMN phone TEXT NOT NULL DEFAULT ''"),
      db.prepare("ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'STAFF'"),
      db.prepare("ALTER TABLE admins ADD COLUMN created_by TEXT"),
      db.prepare(`
        UPDATE admins
        SET login_name = 'admin', display_name = '운영자', role = 'OWNER'
        WHERE id = 'primary'
      `),
    ]);
  }
  if (!adminColumns.results.some((column) => column.name === "slot_serial_no")) {
    await db.prepare("ALTER TABLE admins ADD COLUMN slot_serial_no INTEGER").run();
  }
  const outboxColumns = await db
    .prepare("PRAGMA table_info(notification_outbox)")
    .all<{ name: string }>();
  for (const [name, definition] of [
    ["event_type", "TEXT NOT NULL DEFAULT 'NEW_REQUEST'"],
    ["recipient_account_id", "TEXT"],
    ["telegram_message_id", "TEXT"],
    ["canceled_at", "TEXT"],
  ] as const) {
    if (!outboxColumns.results.some((column) => column.name === name)) {
      await db.prepare(`ALTER TABLE notification_outbox ADD COLUMN ${name} ${definition}`).run();
    }
  }
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS request_operations_assignee_account_idx ON request_operations(assignee_account_id)",
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS service_requests_lookup_phone_idx ON service_requests(lookup_key, phone)",
    )
    .run();
  await db
    .prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS admins_active_staff_slot_idx
      ON admins(slot_serial_no)
      WHERE role = 'STAFF' AND is_active = 1 AND slot_serial_no IS NOT NULL
    `)
    .run();
  await db
    .prepare(`
      CREATE INDEX IF NOT EXISTS notification_outbox_event_idx
      ON notification_outbox(event_type, recipient_account_id)
    `)
    .run();
}

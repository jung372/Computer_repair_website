import { ensureDatabase, getD1 } from "@/data/database";

export type AdminRecord = {
  id: string;
  loginName: string;
  passwordHash: string;
  isActive: boolean;
  sessionVersion: number;
};

type AdminRow = {
  id: string;
  login_name: string;
  password_hash: string;
  is_active: number;
  session_version: number;
};

function mapAdmin(row: AdminRow): AdminRecord {
  return {
    id: row.id,
    loginName: row.login_name,
    passwordHash: row.password_hash,
    isActive: row.is_active === 1,
    sessionVersion: Number(row.session_version),
  };
}

export async function getPrimaryAdmin() {
  await ensureDatabase();
  const row = await getD1()
    .prepare(`
      SELECT id, login_name, password_hash, is_active, session_version
      FROM admins WHERE id = 'primary'
    `)
    .first<AdminRow>();
  return row ? mapAdmin(row) : null;
}

export async function createPrimaryAdmin(passwordHash: string, clientHash: string | null) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db
      .prepare(`
        INSERT INTO admins (
          id, login_name, password_hash, is_active, session_version,
          password_changed_at, created_at, updated_at
        ) VALUES ('primary', 'admin', ?, 1, 1, ?, ?, ?)
      `)
      .bind(passwordHash, now, now, now),
    db
      .prepare(`
        INSERT INTO admin_audit_logs
          (id, admin_id, event_type, client_hash, created_at)
        VALUES (?, 'primary', 'SETUP_SUCCESS', ?, ?)
      `)
      .bind(crypto.randomUUID(), clientHash, now),
  ]);
  return getPrimaryAdmin();
}

export async function markAdminLogin(adminId: string, clientHash: string | null) {
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db
      .prepare("UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, adminId),
    db
      .prepare(`
        INSERT INTO admin_audit_logs
          (id, admin_id, event_type, client_hash, created_at)
        VALUES (?, ?, 'LOGIN_SUCCESS', ?, ?)
      `)
      .bind(crypto.randomUUID(), adminId, clientHash, now),
  ]);
}

export async function changePrimaryAdminPassword(
  passwordHash: string,
  clientHash: string | null,
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db
      .prepare(`
        UPDATE admins
        SET password_hash = ?, session_version = session_version + 1,
            password_changed_at = ?, updated_at = ?
        WHERE id = 'primary' AND is_active = 1
      `)
      .bind(passwordHash, now, now),
    db
      .prepare(`
        INSERT INTO admin_audit_logs
          (id, admin_id, event_type, client_hash, created_at)
        VALUES (?, 'primary', 'PASSWORD_CHANGED', ?, ?)
      `)
      .bind(crypto.randomUUID(), clientHash, now),
  ]);
}

export async function recordAdminAudit(
  eventType: string,
  clientHash: string | null,
  adminId: string | null = null,
) {
  await ensureDatabase();
  await getD1()
    .prepare(`
      INSERT INTO admin_audit_logs
        (id, admin_id, event_type, client_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(crypto.randomUUID(), adminId, eventType, clientHash, new Date().toISOString())
    .run();
}

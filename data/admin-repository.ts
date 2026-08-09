import { ADMIN_LOGIN_NAME, type AccountRole } from "@/lib/account-policy";
import { ensureDatabase, getD1 } from "@/data/database";

export type AdminRecord = {
  id: string;
  loginName: string;
  passwordHash: string;
  displayName: string;
  phone: string;
  role: AccountRole;
  isActive: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
};

export type StaffAccountRecord = AdminRecord & {
  assignedCount: number;
};

type AdminRow = {
  id: string;
  login_name: string;
  password_hash: string;
  display_name: string;
  phone: string;
  role: AccountRole;
  is_active: number;
  session_version: number;
  last_login_at: string | null;
};

const ACCOUNT_SELECT = `
  SELECT id, login_name, password_hash, display_name, phone, role,
         is_active, session_version, last_login_at
  FROM admins
`;

function mapAdmin(row: AdminRow): AdminRecord {
  return {
    id: row.id,
    loginName: row.login_name,
    passwordHash: row.password_hash,
    displayName: row.display_name || (row.role === "OWNER" ? "운영자" : row.login_name),
    phone: row.phone,
    role: row.role,
    isActive: row.is_active === 1,
    sessionVersion: Number(row.session_version),
    lastLoginAt: row.last_login_at,
  };
}

export async function getPrimaryAdmin() {
  return getAdminAccountById("primary");
}

export async function getAdminAccountById(id: string) {
  await ensureDatabase();
  const row = await getD1()
    .prepare(`${ACCOUNT_SELECT} WHERE id = ?`)
    .bind(id)
    .first<AdminRow>();
  return row ? mapAdmin(row) : null;
}

export async function getAdminAccountByLoginName(loginName: string) {
  await ensureDatabase();
  const row = await getD1()
    .prepare(`${ACCOUNT_SELECT} WHERE login_name = ?`)
    .bind(loginName)
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
          id, login_name, password_hash, display_name, phone, role,
          is_active, session_version, password_changed_at, created_at, updated_at
        ) VALUES ('primary', ?, ?, '운영자', '', 'OWNER', 1, 1, ?, ?, ?)
      `)
      .bind(ADMIN_LOGIN_NAME, passwordHash, now, now, now),
    auditStatement(db, "primary", "SETUP_SUCCESS", clientHash, now),
  ]);
  return getPrimaryAdmin();
}

export async function listStaffAccounts() {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT admins.id, admins.login_name, admins.password_hash, admins.display_name,
             admins.phone, admins.role, admins.is_active, admins.session_version,
             admins.last_login_at, COUNT(operations.request_id) AS assigned_count
      FROM admins
      LEFT JOIN request_operations operations
        ON operations.assignee_account_id = admins.id
      WHERE admins.role = 'STAFF'
      GROUP BY admins.id
      ORDER BY admins.is_active DESC, admins.display_name, admins.login_name
    `)
    .all<AdminRow & { assigned_count: number }>();
  return result.results.map((row) => ({
    ...mapAdmin(row),
    assignedCount: Number(row.assigned_count),
  }));
}

export async function listActiveStaffAccounts() {
  const staff = await listStaffAccounts();
  return staff.filter((account) => account.isActive);
}

export async function createStaffAccount(input: {
  loginName: string;
  displayName: string;
  phone: string;
  passwordHash: string;
  createdBy: string;
  clientHash: string | null;
}) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const db = getD1();
  await db.batch([
    db
      .prepare(`
        INSERT INTO admins (
          id, login_name, password_hash, display_name, phone, role, created_by,
          is_active, session_version, password_changed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'STAFF', ?, 1, 1, ?, ?, ?)
      `)
      .bind(
        id,
        input.loginName,
        input.passwordHash,
        input.displayName,
        input.phone,
        input.createdBy,
        now,
        now,
        now,
      ),
    auditStatement(
      db,
      input.createdBy,
      "STAFF_CREATED",
      input.clientHash,
      now,
      { staffId: id, loginName: input.loginName },
    ),
  ]);
  return id;
}

export async function resetStaffPassword(
  staffId: string,
  passwordHash: string,
  changedBy: string,
  clientHash: string | null,
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const db = getD1();
  const result = await db
    .prepare(`
      UPDATE admins
      SET password_hash = ?, session_version = session_version + 1,
          password_changed_at = ?, updated_at = ?
      WHERE id = ? AND role = 'STAFF'
    `)
    .bind(passwordHash, now, now, staffId)
    .run();
  if (!result.meta.changes) return false;
  await recordAdminAudit("STAFF_PASSWORD_RESET", clientHash, changedBy, { staffId });
  return true;
}

export async function setStaffActive(
  staffId: string,
  active: boolean,
  changedBy: string,
  clientHash: string | null,
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const result = await getD1()
    .prepare(`
      UPDATE admins
      SET is_active = ?, session_version = session_version + 1, updated_at = ?
      WHERE id = ? AND role = 'STAFF'
    `)
    .bind(active ? 1 : 0, now, staffId)
    .run();
  if (!result.meta.changes) return false;
  await recordAdminAudit(active ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED", clientHash, changedBy, { staffId });
  return true;
}

export async function markAdminLogin(adminId: string, clientHash: string | null) {
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db
      .prepare("UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, adminId),
    auditStatement(db, adminId, "LOGIN_SUCCESS", clientHash, now),
  ]);
}

export async function changeAccountPassword(
  accountId: string,
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
        WHERE id = ? AND is_active = 1
      `)
      .bind(passwordHash, now, now, accountId),
    auditStatement(db, accountId, "PASSWORD_CHANGED", clientHash, now),
  ]);
}

export async function recordAdminAudit(
  eventType: string,
  clientHash: string | null,
  adminId: string | null = null,
  metadata?: Record<string, unknown>,
) {
  await ensureDatabase();
  await auditStatement(
    getD1(),
    adminId,
    eventType,
    clientHash,
    new Date().toISOString(),
    metadata,
  ).run();
}

function auditStatement(
  db: D1Database,
  adminId: string | null,
  eventType: string,
  clientHash: string | null,
  createdAt: string,
  metadata?: Record<string, unknown>,
) {
  return db
    .prepare(`
      INSERT INTO admin_audit_logs
        (id, admin_id, event_type, client_hash, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      adminId,
      eventType,
      clientHash,
      metadata ? JSON.stringify(metadata) : null,
      createdAt,
    );
}

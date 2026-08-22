import { ensureDatabase, getD1 } from "@/data/database";
import { UNRESOLVED_REQUEST_STATUSES } from "@/lib/domain";
import { decryptStaffChatId, encryptStaffChatId } from "@/lib/security/encrypted-setting";

export type StaffSlotView = {
  serialNo: number;
  label: string;
  telegramConfigured: boolean;
  telegramEnabled: boolean;
  telegramVerifiedAt: string | null;
  maskedChatId: string;
  accountId: string | null;
  loginName: string;
  displayName: string;
  phone: string;
  lastLoginAt: string | null;
  unresolvedCount: number;
  canDelete: boolean;
};

export type AssignmentOption = {
  accountId: string;
  label: string;
  phone: string;
  role: "OWNER" | "STAFF";
  notificationReady: boolean;
};

const unresolvedPlaceholders = UNRESOLVED_REQUEST_STATUSES.map(() => "?").join(", ");

function maskChatId(value: string) {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function listStaffSlots(): Promise<StaffSlotView[]> {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT slots.serial_no, slots.label, slots.telegram_chat_id_ciphertext,
             slots.telegram_chat_id_iv, slots.telegram_enabled,
             slots.telegram_verified_at, account.id AS account_id,
             account.login_name, account.display_name, account.phone,
             account.last_login_at,
             (SELECT COUNT(*)
                FROM request_operations operations
                INNER JOIN service_requests requests ON requests.id = operations.request_id
                WHERE operations.assignee_account_id = account.id
                  AND requests.deleted_at IS NULL
                  AND requests.status IN (${unresolvedPlaceholders})
             ) AS unresolved_count,
             (SELECT COUNT(*) FROM request_operations
                WHERE assignee_account_id = account.id) AS assigned_count,
             (SELECT COUNT(*) FROM request_assignment_history
                WHERE previous_account_id = account.id OR assigned_account_id = account.id
             ) AS history_count,
             (SELECT COUNT(*) FROM notification_outbox
                WHERE recipient_account_id = account.id) AS notification_count
      FROM staff_slots slots
      LEFT JOIN admins account
        ON account.slot_serial_no = slots.serial_no
       AND account.role = 'STAFF' AND account.is_active = 1
      ORDER BY slots.serial_no
    `)
    .bind(...UNRESOLVED_REQUEST_STATUSES)
    .all<{
      serial_no: number;
      label: string;
      telegram_chat_id_ciphertext: string | null;
      telegram_chat_id_iv: string | null;
      telegram_enabled: number;
      telegram_verified_at: string | null;
      account_id: string | null;
      login_name: string | null;
      display_name: string | null;
      phone: string | null;
      last_login_at: string | null;
      unresolved_count: number;
      assigned_count: number;
      history_count: number;
      notification_count: number;
    }>();

  return Promise.all(result.results.map(async (row) => {
    let maskedChatId = "미설정";
    if (row.telegram_chat_id_ciphertext && row.telegram_chat_id_iv) {
      try {
        maskedChatId = maskChatId(
          await decryptStaffChatId(row.telegram_chat_id_ciphertext, row.telegram_chat_id_iv),
        );
      } catch {
        maskedChatId = "설정됨(키 확인 필요)";
      }
    }
    return {
      serialNo: Number(row.serial_no),
      label: row.label,
      telegramConfigured: Boolean(row.telegram_chat_id_ciphertext && row.telegram_chat_id_iv),
      telegramEnabled: row.telegram_enabled === 1,
      telegramVerifiedAt: row.telegram_verified_at,
      maskedChatId,
      accountId: row.account_id,
      loginName: row.login_name ?? "",
      displayName: row.display_name ?? "",
      phone: row.phone ?? "",
      lastLoginAt: row.last_login_at,
      unresolvedCount: Number(row.unresolved_count),
      canDelete: Boolean(
        row.account_id &&
        !row.last_login_at &&
        Number(row.assigned_count) === 0 &&
        Number(row.history_count) === 0 &&
        Number(row.notification_count) === 0
      ),
    };
  }));
}

export async function listAssignmentOptions(): Promise<AssignmentOption[]> {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT account.id, account.role, account.display_name, account.login_name,
             account.phone, account.slot_serial_no, slots.label,
             slots.telegram_enabled, slots.telegram_verified_at,
             slots.telegram_chat_id_ciphertext
      FROM admins account
      LEFT JOIN staff_slots slots ON slots.serial_no = account.slot_serial_no
      WHERE account.is_active = 1
        AND (account.role = 'OWNER' OR account.slot_serial_no IS NOT NULL)
      ORDER BY CASE account.role WHEN 'OWNER' THEN 0 ELSE 1 END, account.slot_serial_no
    `)
    .all<{
      id: string;
      role: "OWNER" | "STAFF";
      display_name: string;
      login_name: string;
      phone: string;
      slot_serial_no: number | null;
      label: string | null;
      telegram_enabled: number | null;
      telegram_verified_at: string | null;
      telegram_chat_id_ciphertext: string | null;
    }>();
  return result.results.map((row) => ({
    accountId: row.id,
    label: row.role === "OWNER"
      ? `${row.display_name || "운영자"}(본인)`
      : `S-${String(row.slot_serial_no).padStart(4, "0")} · ${row.display_name || row.label || row.login_name}`,
    phone: row.phone,
    role: row.role,
    notificationReady: row.role === "OWNER" || (
      row.telegram_enabled === 1 &&
      Boolean(row.telegram_verified_at) &&
      Boolean(row.telegram_chat_id_ciphertext)
    ),
  }));
}

export async function saveStaffSlot(input: {
  slotSerialNo: number;
  label: string;
  chatId?: string;
  clearChatId: boolean;
  telegramEnabled: boolean;
  changedBy: string;
}) {
  await ensureDatabase();
  const slot = await getD1()
    .prepare("SELECT telegram_chat_id_ciphertext FROM staff_slots WHERE serial_no = ?")
    .bind(input.slotSerialNo)
    .first<{ telegram_chat_id_ciphertext: string | null }>();
  if (!slot) throw new Error("SLOT_NOT_FOUND");
  const now = new Date().toISOString();
  const encrypted = input.chatId ? await encryptStaffChatId(input.chatId) : null;
  const hasChat = Boolean(encrypted || (!input.clearChatId && slot.telegram_chat_id_ciphertext));
  if (encrypted) {
    await getD1().batch([
      getD1().prepare(`
        UPDATE staff_slots
        SET label = ?, telegram_chat_id_ciphertext = ?, telegram_chat_id_iv = ?,
            telegram_enabled = ?, telegram_verified_at = NULL,
            updated_by = ?, updated_at = ?
        WHERE serial_no = ?
      `).bind(input.label, encrypted.ciphertext, encrypted.iv,
        input.telegramEnabled ? 1 : 0, input.changedBy, now, input.slotSerialNo),
      auditStatement(input.changedBy, "STAFF_SLOT_UPDATED", now, { slot: input.slotSerialNo }),
    ]);
    return;
  }
  await getD1().batch([
    getD1().prepare(`
      UPDATE staff_slots
      SET label = ?,
          telegram_chat_id_ciphertext = CASE WHEN ? THEN NULL ELSE telegram_chat_id_ciphertext END,
          telegram_chat_id_iv = CASE WHEN ? THEN NULL ELSE telegram_chat_id_iv END,
          telegram_enabled = ?,
          telegram_verified_at = CASE WHEN ? THEN NULL ELSE telegram_verified_at END,
          updated_by = ?, updated_at = ?
      WHERE serial_no = ?
    `).bind(
      input.label,
      input.clearChatId ? 1 : 0,
      input.clearChatId ? 1 : 0,
      !input.clearChatId && input.telegramEnabled && hasChat ? 1 : 0,
      input.clearChatId ? 1 : 0,
      input.changedBy,
      now,
      input.slotSerialNo,
    ),
    auditStatement(input.changedBy, "STAFF_SLOT_UPDATED", now, { slot: input.slotSerialNo }),
  ]);
}

export async function createStaffInSlot(input: {
  slotSerialNo: number;
  loginName: string;
  displayName: string;
  phone: string;
  passwordHash: string;
  changedBy: string;
}) {
  await ensureDatabase();
  const db = getD1();
  const occupied = await db.prepare(`
    SELECT 1 AS found FROM admins
    WHERE slot_serial_no = ? AND role = 'STAFF' AND is_active = 1
  `).bind(input.slotSerialNo).first();
  if (occupied) throw new Error("SLOT_OCCUPIED");
  const duplicate = await db.prepare("SELECT 1 AS found FROM admins WHERE lower(login_name) = lower(?)")
    .bind(input.loginName).first();
  if (duplicate) throw new Error("LOGIN_NAME_EXISTS");
  const slot = await db.prepare("SELECT 1 AS found FROM staff_slots WHERE serial_no = ?")
    .bind(input.slotSerialNo).first();
  if (!slot) throw new Error("SLOT_NOT_FOUND");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO admins (
        id, login_name, password_hash, display_name, phone, role, created_by,
        slot_serial_no, is_active, session_version, password_changed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'STAFF', ?, ?, 1, 1, ?, ?, ?)
    `).bind(id, input.loginName, input.passwordHash, input.displayName, input.phone,
      input.changedBy, input.slotSerialNo, now, now, now),
    auditStatement(input.changedBy, "STAFF_CREATED", now, { staffId: id, slot: input.slotSerialNo }),
  ]);
  return id;
}

export async function updateStaffInSlot(input: {
  accountId: string;
  loginName: string;
  displayName: string;
  phone: string;
  changedBy: string;
}) {
  await ensureDatabase();
  const db = getD1();
  const account = await db.prepare(`
    SELECT id, login_name, password_hash, slot_serial_no
    FROM admins
    WHERE id = ? AND role = 'STAFF' AND is_active = 1 AND slot_serial_no IS NOT NULL
  `).bind(input.accountId).first<{
    id: string;
    login_name: string;
    password_hash: string;
    slot_serial_no: number;
  }>();
  if (!account) throw new Error("STAFF_NOT_FOUND");
  const now = new Date().toISOString();
  if (account.login_name.toLowerCase() === input.loginName.toLowerCase()) {
    const result = await db.prepare(`
    UPDATE admins SET login_name = ?, display_name = ?, phone = ?, updated_at = ?
    WHERE id = ? AND role = 'STAFF' AND is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM admins duplicate
        WHERE lower(duplicate.login_name) = lower(?) AND duplicate.id <> ?
      )
  `).bind(input.loginName, input.displayName, input.phone, now,
    input.accountId, input.loginName, input.accountId).run();
    if (!result.meta.changes) throw new Error("STAFF_UPDATE_CONFLICT");
    await auditStatement(input.changedBy, "STAFF_UPDATED", now, { staffId: input.accountId }).run();
    return;
  }

  const duplicate = await db.prepare("SELECT 1 AS found FROM admins WHERE lower(login_name) = lower(?)")
    .bind(input.loginName).first();
  if (duplicate) throw new Error("LOGIN_NAME_EXISTS");
  const replacementId = crypto.randomUUID();
  await db.batch([
    db.prepare(`
      INSERT INTO request_assignment_history (
        id, request_id, previous_account_id, assignee_name_snapshot,
        event_type, reason, changed_by, created_at
      )
      SELECT lower(hex(randomblob(16))), operations.request_id, ?, ?,
             'UNASSIGNED', 'STAFF_ID_CHANGED', ?, ?
      FROM request_operations operations
      INNER JOIN service_requests requests ON requests.id = operations.request_id
      WHERE operations.assignee_account_id = ?
        AND requests.deleted_at IS NULL
        AND requests.status IN (${unresolvedPlaceholders})
    `).bind(input.accountId, input.displayName, input.changedBy, now, input.accountId,
      ...UNRESOLVED_REQUEST_STATUSES),
    db.prepare(`
      UPDATE request_operations
      SET assignee = '', assignee_phone = '', assignee_account_id = NULL,
          assigned_by = ?, assigned_at = ?, updated_at = ?
      WHERE assignee_account_id = ? AND request_id IN (
        SELECT id FROM service_requests
        WHERE deleted_at IS NULL AND status IN (${unresolvedPlaceholders})
      )
    `).bind(input.changedBy, now, now, input.accountId, ...UNRESOLVED_REQUEST_STATUSES),
    db.prepare(`
      UPDATE notification_outbox
      SET status = 'CANCELED', canceled_at = ?, updated_at = ?
      WHERE recipient_account_id = ? AND status IN ('PENDING', 'FAILED', 'CONFIG_REQUIRED')
    `).bind(now, now, input.accountId),
    db.prepare(`
      UPDATE admins
      SET is_active = 0, slot_serial_no = NULL,
          session_version = session_version + 1, updated_at = ?
      WHERE id = ? AND role = 'STAFF'
    `).bind(now, input.accountId),
    db.prepare(`
      INSERT INTO admins (
        id, login_name, password_hash, display_name, phone, role, created_by,
        slot_serial_no, is_active, session_version, password_changed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'STAFF', ?, ?, 1, 1, ?, ?, ?)
    `).bind(replacementId, input.loginName, account.password_hash, input.displayName,
      input.phone, input.changedBy, account.slot_serial_no, now, now, now),
    auditStatement(input.changedBy, "STAFF_ID_CHANGED", now, {
      previousStaffId: input.accountId,
      replacementStaffId: replacementId,
      slot: Number(account.slot_serial_no),
    }),
  ]);
}

export async function resetSlotStaffPassword(
  accountId: string,
  passwordHash: string,
  changedBy: string,
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const result = await getD1().prepare(`
    UPDATE admins
    SET password_hash = ?, session_version = session_version + 1,
        password_changed_at = ?, updated_at = ?
    WHERE id = ? AND role = 'STAFF' AND is_active = 1
  `).bind(passwordHash, now, now, accountId).run();
  if (!result.meta.changes) throw new Error("STAFF_NOT_FOUND");
  await auditStatement(changedBy, "STAFF_PASSWORD_RESET", now, { staffId: accountId }).run();
}

export async function offboardSlotStaff(accountId: string, changedBy: string) {
  await ensureDatabase();
  const db = getD1();
  const account = await db.prepare(`
    SELECT id, display_name, slot_serial_no FROM admins
    WHERE id = ? AND role = 'STAFF' AND is_active = 1 AND slot_serial_no IS NOT NULL
  `).bind(accountId).first<{ id: string; display_name: string; slot_serial_no: number }>();
  if (!account) throw new Error("STAFF_NOT_FOUND");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO request_assignment_history (
        id, request_id, previous_account_id, assignee_name_snapshot,
        event_type, reason, changed_by, created_at
      )
      SELECT lower(hex(randomblob(16))), operations.request_id, ?, ?,
             'UNASSIGNED', 'STAFF_OFFBOARDED', ?, ?
      FROM request_operations operations
      INNER JOIN service_requests requests ON requests.id = operations.request_id
      WHERE operations.assignee_account_id = ?
        AND requests.deleted_at IS NULL
        AND requests.status IN (${unresolvedPlaceholders})
    `).bind(accountId, account.display_name, changedBy, now, accountId,
      ...UNRESOLVED_REQUEST_STATUSES),
    db.prepare(`
      UPDATE request_operations
      SET assignee = '', assignee_phone = '', assignee_account_id = NULL,
          assigned_by = ?, assigned_at = ?, updated_at = ?
      WHERE assignee_account_id = ? AND request_id IN (
        SELECT id FROM service_requests
        WHERE deleted_at IS NULL AND status IN (${unresolvedPlaceholders})
      )
    `).bind(changedBy, now, now, accountId, ...UNRESOLVED_REQUEST_STATUSES),
    db.prepare(`
      UPDATE notification_outbox
      SET status = 'CANCELED', canceled_at = ?, updated_at = ?
      WHERE recipient_account_id = ? AND status IN ('PENDING', 'FAILED', 'CONFIG_REQUIRED')
    `).bind(now, now, accountId),
    db.prepare(`
      UPDATE admins
      SET is_active = 0, slot_serial_no = NULL,
          session_version = session_version + 1, updated_at = ?
      WHERE id = ? AND role = 'STAFF'
    `).bind(now, accountId),
    auditStatement(changedBy, "STAFF_OFFBOARDED", now, {
      staffId: accountId,
      slot: Number(account.slot_serial_no),
    }),
  ]);
}

export async function permanentlyDeleteUnusedStaff(
  accountId: string,
  confirmation: string,
  changedBy: string,
) {
  await ensureDatabase();
  const db = getD1();
  const account = await db.prepare(`
    SELECT id, login_name, slot_serial_no FROM admins
    WHERE id = ? AND role = 'STAFF' AND is_active = 1
      AND last_login_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM request_operations WHERE assignee_account_id = admins.id)
      AND NOT EXISTS (SELECT 1 FROM request_assignment_history
        WHERE previous_account_id = admins.id OR assigned_account_id = admins.id)
      AND NOT EXISTS (SELECT 1 FROM notification_outbox WHERE recipient_account_id = admins.id)
  `).bind(accountId).first<{ id: string; login_name: string; slot_serial_no: number | null }>();
  if (!account || confirmation !== account.login_name) throw new Error("STAFF_DELETE_NOT_ALLOWED");
  const deleted = await db.prepare(`
    DELETE FROM admins
    WHERE id = ? AND role = 'STAFF' AND is_active = 1 AND last_login_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM request_operations WHERE assignee_account_id = admins.id)
      AND NOT EXISTS (SELECT 1 FROM request_assignment_history
        WHERE previous_account_id = admins.id OR assigned_account_id = admins.id)
      AND NOT EXISTS (SELECT 1 FROM notification_outbox WHERE recipient_account_id = admins.id)
  `).bind(accountId).run();
  if (!deleted.meta.changes) throw new Error("STAFF_DELETE_NOT_ALLOWED");
  await auditStatement(changedBy, "STAFF_PERMANENTLY_DELETED", new Date().toISOString(), {
    staffId: accountId,
    slot: account.slot_serial_no,
  }).run();
}

export async function getStaffTelegramRecipient(accountId: string, requestId: string) {
  await ensureDatabase();
  const row = await getD1().prepare(`
    SELECT slots.telegram_chat_id_ciphertext, slots.telegram_chat_id_iv
    FROM admins account
    INNER JOIN staff_slots slots ON slots.serial_no = account.slot_serial_no
    INNER JOIN request_operations operations ON operations.assignee_account_id = account.id
    WHERE account.id = ? AND operations.request_id = ?
      AND account.role = 'STAFF' AND account.is_active = 1
      AND slots.telegram_enabled = 1 AND slots.telegram_verified_at IS NOT NULL
  `).bind(accountId, requestId).first<{
    telegram_chat_id_ciphertext: string | null;
    telegram_chat_id_iv: string | null;
  }>();
  if (!row?.telegram_chat_id_ciphertext || !row.telegram_chat_id_iv) return null;
  return decryptStaffChatId(row.telegram_chat_id_ciphertext, row.telegram_chat_id_iv);
}

export async function getStaffSlotChatId(slotSerialNo: number) {
  await ensureDatabase();
  const row = await getD1().prepare(`
    SELECT telegram_chat_id_ciphertext, telegram_chat_id_iv FROM staff_slots WHERE serial_no = ?
  `).bind(slotSerialNo).first<{
    telegram_chat_id_ciphertext: string | null;
    telegram_chat_id_iv: string | null;
  }>();
  if (!row?.telegram_chat_id_ciphertext || !row.telegram_chat_id_iv) return null;
  return decryptStaffChatId(row.telegram_chat_id_ciphertext, row.telegram_chat_id_iv);
}

export async function markStaffSlotVerified(slotSerialNo: number, changedBy: string) {
  const now = new Date().toISOString();
  await getD1().batch([
    getD1().prepare(`
      UPDATE staff_slots
      SET telegram_verified_at = ?, telegram_enabled = 1, updated_by = ?, updated_at = ?
      WHERE serial_no = ?
    `).bind(now, changedBy, now, slotSerialNo),
    getD1().prepare(`
      UPDATE notification_outbox
      SET status = 'PENDING', next_attempt_at = ?, last_error = NULL, updated_at = ?
      WHERE status = 'CONFIG_REQUIRED' AND event_type = 'STAFF_ASSIGNED'
        AND recipient_account_id IN (
          SELECT id FROM admins
          WHERE slot_serial_no = ? AND role = 'STAFF' AND is_active = 1
        )
    `).bind(now, now, slotSerialNo),
    auditStatement(changedBy, "STAFF_CHAT_TEST_SUCCEEDED", now, { slot: slotSerialNo }),
  ]);
}

function auditStatement(
  adminId: string,
  eventType: string,
  now: string,
  metadata: Record<string, unknown>,
) {
  return getD1().prepare(`
    INSERT INTO admin_audit_logs (id, admin_id, event_type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), adminId, eventType, JSON.stringify(metadata), now);
}

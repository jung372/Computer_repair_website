import {
  REQUEST_STATUSES,
  UNRESOLVED_REQUEST_STATUSES,
  type RequestStatus,
  type ServiceRequestRecord,
} from "@/lib/domain";
import { getRuntimeString } from "@/lib/runtime-config";
import { ensureDatabase, getD1 } from "./database";
import { mapRequest, type RequestRow } from "./request-repository";

export type AdminRequestFilters = {
  q?: string;
  assignee?: string;
  customerType?: string;
  integratedFrom?: string;
  integratedTo?: string;
  receivedFrom?: string;
  receivedTo?: string;
  completedFrom?: string;
  completedTo?: string;
  statuses?: string[];
};

export type RequestOperationsRecord = {
  serialNumber: number;
  receiptType: string;
  assignee: string;
  assigneePhone: string;
  assigneeAccountId: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  customerType: string;
  landline: string;
  invoiceDate: string | null;
  invoiceContent: string;
  title: string;
  requestCategory: string;
  receivedDate: string;
  visitTiming: string;
  visitDate: string | null;
  completedDate: string | null;
  paymentMethod: string;
  totalAmount: number;
  materialCost: number;
  totalVatAmount: number;
  materialVatAmount: number;
  technicianIncome: number;
  officeDeposit: number;
  operationsUpdatedAt: string;
};

export type AdminRequestRecord = ServiceRequestRecord & RequestOperationsRecord;

type AdminRequestRow = RequestRow & {
  serial_no: number;
  receipt_type: string;
  assignee: string;
  assignee_phone: string;
  assignee_account_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  customer_type: string;
  landline: string;
  invoice_date: string | null;
  invoice_content: string;
  operation_title: string;
  request_category: string;
  received_date: string;
  visit_timing: string;
  visit_date: string | null;
  completed_date: string | null;
  payment_method: string;
  total_amount: number;
  material_cost: number;
  vat_amount: number;
  material_vat_amount: number;
  technician_income: number;
  office_deposit: number;
  operations_updated_at: string;
};

export type AdminRequestRecordUpdate = {
  name: string;
  address1: string;
  address2: string;
  symptom: string;
  description: string;
  status: RequestStatus;
  publicNote: string;
  internalNote: string;
  receiptType: string;
  customerType: string;
  landline: string;
  invoiceDate: string | null;
  invoiceContent: string;
  title: string;
  requestCategory: string;
  receivedDate: string;
  visitTiming: string;
  visitDate: string | null;
  completedDate: string | null;
  paymentMethod: string;
  totalAmount: number;
  materialCost: number;
  totalVatAmount: number;
  materialVatAmount: number;
  technicianIncome: number;
  officeDeposit: number;
};

const ADMIN_REQUEST_SELECT = `
  SELECT
    sr.*,
    serial.serial_no,
    operations.receipt_type,
    COALESCE(NULLIF(assignee_account.display_name, ''), NULLIF(assignee_account.login_name, ''), operations.assignee) AS assignee,
    COALESCE(NULLIF(assignee_account.phone, ''), operations.assignee_phone) AS assignee_phone,
    operations.assignee_account_id,
    operations.assigned_by,
    operations.assigned_at,
    operations.customer_type,
    operations.landline,
    operations.invoice_date,
    operations.invoice_content,
    operations.title AS operation_title,
    operations.request_category,
    operations.received_date,
    operations.visit_timing,
    operations.visit_date,
    operations.completed_date,
    operations.payment_method,
    operations.total_amount,
    operations.material_cost,
    operations.vat_amount,
    operations.material_vat_amount,
    operations.technician_income,
    operations.office_deposit,
    operations.updated_at AS operations_updated_at
  FROM service_requests sr
  INNER JOIN request_serials serial ON serial.request_id = sr.id
  INNER JOIN request_operations operations ON operations.request_id = sr.id
  LEFT JOIN admins assignee_account ON assignee_account.id = operations.assignee_account_id
`;

function mapAdminRequest(row: AdminRequestRow): AdminRequestRecord {
  return {
    ...mapRequest(row),
    serialNumber: Number(row.serial_no),
    receiptType: row.receipt_type,
    assignee: row.assignee,
    assigneePhone: row.assignee_phone,
    assigneeAccountId: row.assignee_account_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    customerType: row.customer_type,
    landline: row.landline,
    invoiceDate: row.invoice_date,
    invoiceContent: row.invoice_content,
    title: row.operation_title,
    requestCategory: row.request_category,
    receivedDate: row.received_date,
    visitTiming: row.visit_timing,
    visitDate: row.visit_date,
    completedDate: row.completed_date,
    paymentMethod: row.payment_method,
    totalAmount: Number(row.total_amount),
    materialCost: Number(row.material_cost),
    totalVatAmount: Number(row.vat_amount),
    materialVatAmount: Number(row.material_vat_amount),
    technicianIncome: Number(row.technician_income),
    officeDeposit: Number(row.office_deposit),
    operationsUpdatedAt: row.operations_updated_at,
  };
}

function addDateRange(
  clauses: string[],
  values: unknown[],
  field: string,
  from?: string,
  to?: string,
) {
  if (from) {
    clauses.push(`${field} >= ?`);
    values.push(from);
  }
  if (to) {
    clauses.push(`${field} <= ?`);
    values.push(to);
  }
}

function addIntegratedDateRange(
  clauses: string[],
  values: unknown[],
  from?: string,
  to?: string,
) {
  if (from && to) {
    clauses.push(
      "((operations.received_date BETWEEN ? AND ?) OR (operations.completed_date BETWEEN ? AND ?))",
    );
    values.push(from, to, from, to);
    return;
  }
  if (from) {
    clauses.push("(operations.received_date >= ? OR operations.completed_date >= ?)");
    values.push(from, from);
  }
  if (to) {
    clauses.push("(operations.received_date <= ? OR operations.completed_date <= ?)");
    values.push(to, to);
  }
}

export async function listAdminRequestRecords(
  filters: AdminRequestFilters = {},
  limit = 200,
  assignedAccountId?: string,
) {
  await ensureDatabase();
  const clauses = ["sr.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (assignedAccountId) {
    clauses.push("operations.assignee_account_id = ?");
    values.push(assignedAccountId);
  }
  const query = filters.q?.trim().slice(0, 100);
  if (query) {
    const pattern = `%${query}%`;
    clauses.push(`(
      sr.public_id LIKE ? OR sr.name LIKE ? OR sr.phone LIKE ? OR sr.address1 LIKE ?
      OR sr.symptom LIKE ? OR sr.description LIKE ? OR operations.title LIKE ?
      OR operations.invoice_content LIKE ? OR sr.internal_note LIKE ?
      OR REPLACE(sr.phone, '-', '') LIKE ?
    )`);
    values.push(...Array(10).fill(pattern));
  }
  if (filters.assignee === "__UNASSIGNED__") {
    clauses.push("operations.assignee_account_id IS NULL");
  } else if (filters.assignee) {
    clauses.push("operations.assignee_account_id = ?");
    values.push(filters.assignee);
  }
  if (filters.customerType) {
    clauses.push("operations.customer_type = ?");
    values.push(filters.customerType);
  }
  addIntegratedDateRange(
    clauses,
    values,
    filters.integratedFrom,
    filters.integratedTo,
  );
  addDateRange(
    clauses,
    values,
    "operations.received_date",
    filters.receivedFrom,
    filters.receivedTo,
  );
  addDateRange(
    clauses,
    values,
    "operations.completed_date",
    filters.completedFrom,
    filters.completedTo,
  );
  const statuses = (filters.statuses ?? []).filter((status) =>
    REQUEST_STATUSES.includes(status as RequestStatus),
  );
  if (statuses.length) {
    clauses.push(`sr.status IN (${statuses.map(() => "?").join(", ")})`);
    values.push(...statuses);
  }
  values.push(Math.max(1, Math.min(limit, 500)));
  const result = await getD1()
    .prepare(`
      ${ADMIN_REQUEST_SELECT}
      WHERE ${clauses.join(" AND ")}
      ORDER BY serial.serial_no DESC
      LIMIT ?
    `)
    .bind(...values)
    .all<AdminRequestRow>();
  return result.results.map(mapAdminRequest);
}

export async function getAdminRequestRecord(publicId: string, assignedAccountId?: string) {
  await ensureDatabase();
  const assignmentClause = assignedAccountId ? " AND operations.assignee_account_id = ?" : "";
  const row = await getD1()
    .prepare(`
      ${ADMIN_REQUEST_SELECT}
      WHERE sr.public_id = ? AND sr.deleted_at IS NULL${assignmentClause}
    `)
    .bind(...(assignedAccountId ? [publicId, assignedAccountId] : [publicId]))
    .first<AdminRequestRow>();
  return row ? mapAdminRequest(row) : null;
}

export async function getAdminRequestFilterOptions() {
  await ensureDatabase();
  const customerTypes = await getD1()
    .prepare(
      "SELECT DISTINCT customer_type AS value FROM request_operations WHERE customer_type <> '' ORDER BY customer_type",
    )
    .all<{ value: string }>();
  return {
    customerTypes: customerTypes.results.map((row) => row.value),
  };
}

export async function updateAdminRequestRecord(
  request: AdminRequestRecord,
  update: AdminRequestRecordUpdate,
  changedBy: string,
) {
  await ensureDatabase();
  const db = getD1();
  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(`
        UPDATE service_requests
        SET name = ?, address1 = ?, address2 = ?, region_public = ?,
            symptom = ?, description = ?, status = ?, internal_note = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .bind(
        update.name,
        update.address1,
        update.address2,
        update.address1.split(/\s+/).slice(0, 2).join(" ") || "지역 미입력",
        update.symptom,
        update.description,
        update.status,
        update.internalNote,
        now,
        request.id,
      ),
    db
      .prepare(`
        UPDATE request_operations
        SET receipt_type = ?, customer_type = ?, landline = ?, invoice_date = ?, invoice_content = ?, title = ?,
            request_category = ?, received_date = ?, visit_timing = ?, visit_date = ?, completed_date = ?,
            payment_method = ?, total_amount = ?, material_cost = ?, vat_amount = ?, material_vat_amount = ?,
            technician_income = ?, office_deposit = ?, updated_at = ?
        WHERE request_id = ?
      `)
      .bind(
        update.receiptType,
        update.customerType,
        update.landline,
        update.invoiceDate,
        update.invoiceContent,
        update.title,
        update.requestCategory,
        update.receivedDate,
        update.visitTiming,
        update.visitDate,
        update.completedDate,
        update.paymentMethod,
        update.totalAmount,
        update.materialCost,
        update.totalVatAmount,
        update.materialVatAmount,
        update.technicianIncome,
        update.officeDeposit,
        now,
        request.id,
      ),
  ];
  if (request.status !== update.status || update.publicNote) {
    statements.push(
      db
        .prepare(`
          INSERT INTO request_status_history
            (id, request_id, status, public_note, changed_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          request.id,
          update.status,
          update.publicNote,
          changedBy,
          now,
        ),
    );
  }
  await db.batch(statements);
}

export async function assignAdminRequest(
  publicId: string,
  staffId: string | null,
  assignedBy: string,
  expectedAssigneeAccountId?: string | null,
) {
  await ensureDatabase();
  const db = getD1();
  const request = await getAdminRequestRecord(publicId);
  if (!request) throw new Error("NOT_FOUND");
  if (
    expectedAssigneeAccountId !== undefined &&
    (request.assigneeAccountId ?? null) !== expectedAssigneeAccountId
  ) {
    throw new Error("ASSIGNMENT_CONFLICT");
  }
  const assignee = staffId
    ? await db
        .prepare(`
          SELECT account.id, account.login_name, account.display_name, account.phone,
                 account.role, slots.telegram_enabled, slots.telegram_verified_at,
                 slots.telegram_chat_id_ciphertext
          FROM admins account
          LEFT JOIN staff_slots slots ON slots.serial_no = account.slot_serial_no
          WHERE account.id = ? AND account.is_active = 1
            AND (account.role = 'OWNER' OR account.slot_serial_no IS NOT NULL)
        `)
        .bind(staffId)
        .first<{
          id: string;
          login_name: string;
          display_name: string;
          phone: string;
          role: "OWNER" | "STAFF";
          telegram_enabled: number | null;
          telegram_verified_at: string | null;
          telegram_chat_id_ciphertext: string | null;
        }>()
    : null;
  if (staffId && !assignee) throw new Error("INVALID_ASSIGNEE");
  const now = new Date().toISOString();
  const assigneeName = assignee?.display_name || assignee?.login_name || "";
  const assigneePhone = assignee?.phone || "";
  if ((request.assigneeAccountId ?? null) === (assignee?.id ?? null)) {
    return {
      assigneeAccountId: assignee?.id ?? null,
      assignee: assigneeName,
      assigneePhone,
      assignedAt: request.assignedAt ?? now,
    };
  }
  const notificationReady = Boolean(
    assignee?.role === "STAFF" &&
    assignee.telegram_enabled === 1 &&
    assignee.telegram_verified_at &&
    assignee.telegram_chat_id_ciphertext &&
    getRuntimeString("TELEGRAM_BOT_TOKEN"),
  );
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`
        UPDATE request_operations
        SET assignee_account_id = ?, assignee = ?, assignee_phone = ?,
            assigned_by = ?, assigned_at = ?, updated_at = ?
        WHERE request_id = ?
      `)
      .bind(assignee?.id ?? null, assigneeName, assigneePhone, assignedBy, now, now, request.id),
    db
      .prepare(`
        UPDATE notification_outbox
        SET status = 'CANCELED', canceled_at = ?, updated_at = ?
        WHERE request_id = ? AND event_type = 'STAFF_ASSIGNED'
          AND status IN ('PENDING', 'FAILED', 'CONFIG_REQUIRED')
      `)
      .bind(now, now, request.id),
    db
      .prepare(`
        INSERT INTO request_assignment_history (
          id, request_id, previous_account_id, assigned_account_id,
          assignee_name_snapshot, event_type, changed_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        request.id,
        request.assigneeAccountId,
        assignee?.id ?? null,
        assigneeName,
        assignee ? "ASSIGNED" : "UNASSIGNED",
        assignedBy,
        now,
      ),
    db
      .prepare(`
        INSERT INTO admin_audit_logs
          (id, admin_id, event_type, metadata, created_at)
        VALUES (?, ?, 'REQUEST_ASSIGNED', ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        assignedBy,
        JSON.stringify({
          requestId: request.id,
          publicId,
          previousStaffId: request.assigneeAccountId,
          staffId: assignee?.id ?? null,
        }),
        now,
      ),
  ];
  if (assignee?.role === "STAFF") {
    statements.push(
      db.prepare(`
        INSERT INTO notification_outbox (
          id, request_id, channel, status, attempts, next_attempt_at,
          created_at, updated_at, event_type, recipient_account_id
        ) VALUES (?, ?, 'TELEGRAM', ?, 0, ?, ?, ?, 'STAFF_ASSIGNED', ?)
      `).bind(
        crypto.randomUUID(),
        request.id,
        notificationReady ? "PENDING" : "CONFIG_REQUIRED",
        now,
        now,
        now,
        assignee.id,
      ),
    );
  }
  await db.batch(statements);
  return {
    assigneeAccountId: assignee?.id ?? null,
    assignee: assigneeName,
    assigneePhone,
    assignedAt: now,
  };
}

export async function getDashboardCounts(accountId: string) {
  await ensureDatabase();
  const unresolved = UNRESOLVED_REQUEST_STATUSES.map(() => "?").join(", ");
  const row = await getD1().prepare(`
    SELECT
      SUM(CASE WHEN operations.assignee_account_id IS NULL THEN 1 ELSE 0 END) AS unassigned_count,
      SUM(CASE WHEN requests.status = 'RECEIVED' THEN 1 ELSE 0 END) AS total_received_count,
      SUM(CASE WHEN requests.status IN (${unresolved}) THEN 1 ELSE 0 END) AS total_unresolved_count,
      SUM(CASE WHEN operations.assignee_account_id = ? AND requests.status = 'RECEIVED'
               THEN 1 ELSE 0 END) AS received_count,
      SUM(CASE WHEN operations.assignee_account_id = ?
                AND requests.status IN (${unresolved}) THEN 1 ELSE 0 END) AS unresolved_count,
      SUM(CASE WHEN operations.assignee_account_id = ? THEN 1 ELSE 0 END) AS assigned_count
    FROM service_requests requests
    INNER JOIN request_operations operations ON operations.request_id = requests.id
    WHERE requests.deleted_at IS NULL
  `).bind(...UNRESOLVED_REQUEST_STATUSES, accountId, accountId, ...UNRESOLVED_REQUEST_STATUSES, accountId).first<{
    unassigned_count: number;
    total_received_count: number;
    total_unresolved_count: number;
    received_count: number;
    unresolved_count: number;
    assigned_count: number;
  }>();
  return {
    unassigned: Number(row?.unassigned_count ?? 0),
    totalReceived: Number(row?.total_received_count ?? 0),
    totalUnresolved: Number(row?.total_unresolved_count ?? 0),
    received: Number(row?.received_count ?? 0),
    unresolved: Number(row?.unresolved_count ?? 0),
    assigned: Number(row?.assigned_count ?? 0),
  };
}

import { ensureDatabase, getD1 } from "@/data/database";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/domain";

export type SettlementFilters = {
  from: string;
  to: string;
  assignee?: string;
  paymentMethods?: string[];
  statuses?: string[];
  page?: number;
  pageSize?: number;
};

export type SettlementRecord = {
  publicId: string;
  serialNumber: number;
  customerName: string;
  phone: string;
  completedDate: string;
  assignee: string;
  paymentMethod: string;
  totalAmount: number;
  materialCost: number;
  vatAmount: number;
  income: number;
  status: RequestStatus;
};

export type SettlementTotals = {
  count: number;
  totalAmount: number;
  materialCost: number;
  vatAmount: number;
  income: number;
  outstandingAmount: number;
};

type SettlementRow = {
  public_id: string;
  serial_no: number;
  customer_name: string;
  phone: string;
  completed_date: string;
  assignee_name: string;
  payment_method: string;
  total_amount: number;
  material_cost: number;
  vat_amount: number;
  income: number;
  status: RequestStatus;
};

function settlementConditions(
  filters: SettlementFilters,
  assignedAccountId?: string,
) {
  const clauses = [
    "requests.deleted_at IS NULL",
    "operations.completed_date IS NOT NULL",
    "operations.completed_date >= ?",
    "operations.completed_date <= ?",
  ];
  const values: unknown[] = [filters.from, filters.to];

  if (assignedAccountId) {
    clauses.push("operations.assignee_account_id = ?");
    values.push(assignedAccountId);
  } else if (filters.assignee === "__UNASSIGNED__") {
    clauses.push("operations.assignee_account_id IS NULL");
  } else if (filters.assignee) {
    clauses.push("operations.assignee_account_id = ?");
    values.push(filters.assignee);
  }

  const paymentMethods = [...new Set(
    (filters.paymentMethods ?? []).map((value) => value.trim().slice(0, 40)).filter(Boolean),
  )].slice(0, 20);
  if (paymentMethods.length) {
    clauses.push(`operations.payment_method IN (${paymentMethods.map(() => "?").join(", ")})`);
    values.push(...paymentMethods);
  }

  const statuses = [...new Set(filters.statuses ?? [])].filter((status) =>
    REQUEST_STATUSES.includes(status as RequestStatus),
  );
  if (statuses.length) {
    clauses.push(`requests.status IN (${statuses.map(() => "?").join(", ")})`);
    values.push(...statuses);
  }
  return { clauses, values };
}

export async function getSettlementReport(
  filters: SettlementFilters,
  assignedAccountId?: string,
) {
  await ensureDatabase();
  const db = getD1();
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 50, 100));
  const page = Math.max(1, filters.page ?? 1);
  const { clauses, values } = settlementConditions(filters, assignedAccountId);
  const where = clauses.join(" AND ");

  const [rows, aggregate] = await Promise.all([
    db.prepare(`
      SELECT requests.public_id, serial.serial_no,
             requests.name AS customer_name, requests.phone,
             operations.completed_date,
             COALESCE(NULLIF(account.display_name, ''), NULLIF(account.login_name, ''),
                      NULLIF(operations.assignee, ''), '미배정') AS assignee_name,
             operations.payment_method, operations.total_amount,
             operations.material_cost,
             operations.vat_amount + operations.material_vat_amount AS vat_amount,
             operations.technician_income AS income,
             requests.status
      FROM service_requests requests
      INNER JOIN request_operations operations ON operations.request_id = requests.id
      INNER JOIN request_serials serial ON serial.request_id = requests.id
      LEFT JOIN admins account ON account.id = operations.assignee_account_id
      WHERE ${where}
      ORDER BY operations.completed_date DESC, serial.serial_no DESC
      LIMIT ? OFFSET ?
    `).bind(...values, pageSize, (page - 1) * pageSize).all<SettlementRow>(),
    db.prepare(`
      SELECT COUNT(*) AS total_count,
             COALESCE(SUM(operations.total_amount), 0) AS total_amount,
             COALESCE(SUM(operations.material_cost), 0) AS material_cost,
             COALESCE(SUM(operations.vat_amount + operations.material_vat_amount), 0) AS vat_amount,
             COALESCE(SUM(operations.technician_income), 0) AS income,
             COALESCE(SUM(CASE WHEN requests.status = 'COMPANY_UNPAID'
                               THEN operations.total_amount ELSE 0 END), 0) AS outstanding_amount
      FROM service_requests requests
      INNER JOIN request_operations operations ON operations.request_id = requests.id
      WHERE ${where}
    `).bind(...values).first<{
      total_count: number;
      total_amount: number;
      material_cost: number;
      vat_amount: number;
      income: number;
      outstanding_amount: number;
    }>(),
  ]);

  const records: SettlementRecord[] = rows.results.map((row) => ({
    publicId: row.public_id,
    serialNumber: Number(row.serial_no),
    customerName: row.customer_name || "미상",
    phone: row.phone,
    completedDate: row.completed_date,
    assignee: row.assignee_name,
    paymentMethod: row.payment_method || "미입력",
    totalAmount: Number(row.total_amount),
    materialCost: Number(row.material_cost),
    vatAmount: Number(row.vat_amount),
    income: Number(row.income),
    status: row.status,
  }));
  const totals: SettlementTotals = {
    count: Number(aggregate?.total_count ?? 0),
    totalAmount: Number(aggregate?.total_amount ?? 0),
    materialCost: Number(aggregate?.material_cost ?? 0),
    vatAmount: Number(aggregate?.vat_amount ?? 0),
    income: Number(aggregate?.income ?? 0),
    outstandingAmount: Number(aggregate?.outstanding_amount ?? 0),
  };
  return { records, totals, page, pageSize };
}

export async function getSettlementFilterOptions() {
  await ensureDatabase();
  const db = getD1();
  const [payments, assignees] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT payment_method AS value
      FROM request_operations
      WHERE payment_method <> ''
      ORDER BY payment_method
    `).all<{ value: string }>(),
    db.prepare(`
      SELECT account.id, account.role, account.display_name, account.login_name,
             account.slot_serial_no, account.is_active
      FROM admins account
      WHERE account.role = 'OWNER'
         OR account.slot_serial_no IS NOT NULL
      ORDER BY CASE account.role WHEN 'OWNER' THEN 0 ELSE 1 END,
               account.is_active DESC, account.slot_serial_no, account.display_name
    `).all<{
      id: string;
      role: "OWNER" | "STAFF";
      display_name: string;
      login_name: string;
      slot_serial_no: number | null;
      is_active: number;
    }>(),
  ]);
  return {
    paymentMethods: payments.results.map((row) => row.value),
    assignees: assignees.results.map((row) => ({
      id: row.id,
      label: row.role === "OWNER"
        ? `${row.display_name || "운영자"}(본인)`
        : `${row.display_name || row.login_name}${row.is_active === 1 ? "" : " (퇴사)"}`,
    })),
  };
}

import { ensureDatabase, getD1 } from "@/data/database";

export const PROFIT_SHARE_POLICY_VERSION = "2026-10-09-v1";

type ProfitShareRow = {
  public_id: string;
  serial_no: number;
  completed_date: string;
  receipt_type: string;
  income: number;
  assignee_account_id: string | null;
  assignee_role: string | null;
  assignee_name: string | null;
};

export type ProfitShareRecord = {
  publicId: string;
  serialNumber: number;
  completedDate: string;
  receiptType: string;
  income: number;
  performerName: string;
  performerRole: "OWNER" | "STAFF" | null;
  allocationStatus: "ALLOCATED" | "REVIEW_REQUIRED";
  ownerAmount: number;
  staffAmount: number;
  advertisingAmount: number;
};

export function allocateProfitShare(row: ProfitShareRow): ProfitShareRecord {
  const income = Number(row.income);
  const base = {
    publicId: row.public_id,
    serialNumber: Number(row.serial_no),
    completedDate: row.completed_date,
    receiptType: row.receipt_type,
    income,
    performerName: row.assignee_name || "수행자 확인 필요",
  };
  const pending: ProfitShareRecord = {
    ...base, performerRole: null, allocationStatus: "REVIEW_REQUIRED",
    ownerAmount: 0, staffAmount: 0, advertisingAmount: 0,
  };
  if (!Number.isSafeInteger(income) || income < 0) return pending;
  if (row.receipt_type === "오프라인접수" || row.receipt_type === "기타접수") {
    return { ...base, performerName: "운영자", performerRole: "OWNER", allocationStatus: "ALLOCATED", ownerAmount: income, staffAmount: 0, advertisingAmount: 0 };
  }
  if (row.receipt_type !== "온라인접수" && row.receipt_type !== "콜센터접수") return pending;
  if (!row.assignee_account_id || (row.assignee_role !== "OWNER" && row.assignee_role !== "STAFF")) return pending;
  if (row.assignee_role === "OWNER") {
    const advertisingAmount = Math.floor(income * 30 / 100);
    return { ...base, performerRole: "OWNER", allocationStatus: "ALLOCATED", ownerAmount: income - advertisingAmount, staffAmount: 0, advertisingAmount };
  }
  const staffAmount = Math.floor(income * 50 / 100);
  const advertisingAmount = Math.floor(income * 25 / 100);
  return { ...base, performerRole: "STAFF", allocationStatus: "ALLOCATED", ownerAmount: income - staffAmount - advertisingAmount, staffAmount, advertisingAmount };
}

export async function getProfitShareReport(from: string, to: string) {
  await ensureDatabase();
  const db = getD1();
  const result = await db.prepare(`
    SELECT requests.public_id, serial.serial_no, operations.completed_date,
           operations.receipt_type, operations.technician_income AS income,
           operations.assignee_account_id, account.role AS assignee_role,
           COALESCE(NULLIF(account.display_name, ''), NULLIF(account.login_name, '')) AS assignee_name
    FROM service_requests requests
    INNER JOIN request_operations operations ON operations.request_id = requests.id
    INNER JOIN request_serials serial ON serial.request_id = requests.id
    LEFT JOIN admins account ON account.id = operations.assignee_account_id
    WHERE requests.deleted_at IS NULL
      AND requests.status IN ('SHIPPED', 'ONSITE_COMPLETED', 'COMPANY_UNPAID',
                              'TECH_PERSONAL_CALL', 'COMPANY_PERSONAL_CALL', 'COMPLETED')
      AND operations.completed_date >= ? AND operations.completed_date <= ?
    ORDER BY operations.completed_date DESC, serial.serial_no DESC
  `).bind(from, to).all<ProfitShareRow>();
  const records = result.results.map(allocateProfitShare);
  const allocated = records.filter((record) => record.allocationStatus === "ALLOCATED");
  const pending = records.filter((record) => record.allocationStatus === "REVIEW_REQUIRED");
  return {
    policyVersion: PROFIT_SHARE_POLICY_VERSION,
    from, to,
    accrualOnly: true,
    historicalPerformerBasis: "assigned_account_role",
    totals: {
      count: records.length,
      income: records.reduce((sum, record) => sum + record.income, 0),
      allocatedCount: allocated.length,
      pendingCount: pending.length,
      pendingIncome: pending.reduce((sum, record) => sum + record.income, 0),
      ownerAmount: allocated.reduce((sum, record) => sum + record.ownerAmount, 0),
      staffAmount: allocated.reduce((sum, record) => sum + record.staffAmount, 0),
      advertisingAmount: allocated.reduce((sum, record) => sum + record.advertisingAmount, 0),
    },
    records,
  };
}

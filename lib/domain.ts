export const DEVICE_TYPES = ["desktop", "laptop", "monitor", "apple", "data-recovery", "other"] as const;
export const UNSPECIFIED_DEVICE_TYPE = "unspecified" as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
export type StoredDeviceType = DeviceType | typeof UNSPECIFIED_DEVICE_TYPE;

export const DEVICE_LABELS: Record<StoredDeviceType, string> = {
  desktop: "컴퓨터",
  laptop: "노트북",
  monitor: "모니터",
  apple: "애플기기",
  "data-recovery": "데이터 복구",
  other: "기타기기",
  unspecified: "미입력",
};

export const REQUEST_STATUSES = [
  "RECEIVED",
  "CONSULTING",
  "SCHEDULED",
  "REPAIRING",
  "SHIPPED",
  "ONSITE_COMPLETED",
  "COMPANY_UNPAID",
  "PREVISIT_CANCELED",
  "ONSITE_CANCELED",
  "INSHOP_CANCELED",
  "TECH_PERSONAL_CALL",
  "COMPANY_PERSONAL_CALL",
  "COMPLETED",
  "ON_HOLD",
  "CANCELED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const UNRESOLVED_REQUEST_STATUSES = [
  "RECEIVED",
  "CONSULTING",
  "SCHEDULED",
  "REPAIRING",
  "COMPANY_UNPAID",
  "ON_HOLD",
] as const satisfies readonly RequestStatus[];

export const ADMIN_DASHBOARD_FILTER_KEYS = [
  "unassigned",
  "total-unresolved",
  "my-unresolved",
] as const;

export type AdminDashboardFilterKey =
  (typeof ADMIN_DASHBOARD_FILTER_KEYS)[number];
export type AdminDashboardRole = "OWNER" | "STAFF";

export type AdminDashboardFilter = {
  assignee: string;
  statuses: RequestStatus[];
};

export function getAdminDashboardFilter(
  key: AdminDashboardFilterKey,
  role: AdminDashboardRole,
  accountId: string,
): AdminDashboardFilter | null {
  if (role === "STAFF" && !key.startsWith("my-")) return null;

  switch (key) {
    case "unassigned":
      return { assignee: "__UNASSIGNED__", statuses: [] };
    case "total-unresolved":
      return { assignee: "", statuses: [...UNRESOLVED_REQUEST_STATUSES] };
    case "my-unresolved":
      return {
        assignee: role === "OWNER" ? accountId : "",
        statuses: [...UNRESOLVED_REQUEST_STATUSES],
      };
  }
}

export function buildAdminDashboardFilterHref(
  key: AdminDashboardFilterKey,
  role: AdminDashboardRole,
  accountId: string,
) {
  const filter = getAdminDashboardFilter(key, role, accountId);
  if (!filter) return "/admin";

  const parameters = new URLSearchParams({ dashboard: key });
  if (filter.assignee) parameters.set("assignee", filter.assignee);
  for (const status of filter.statuses) parameters.append("status", status);
  return `/admin?${parameters.toString()}`;
}

export function isAdminDashboardFilterActive(
  selectedKey: string,
  key: AdminDashboardFilterKey,
  current: { assignee: string; statuses: string[] },
  role: AdminDashboardRole,
  accountId: string,
) {
  if (selectedKey !== key) return false;
  const expected = getAdminDashboardFilter(key, role, accountId);
  if (!expected || current.assignee !== expected.assignee) return false;

  const currentStatuses = normalizeRequestStatuses(current.statuses);
  const expectedStatuses = normalizeRequestStatuses(expected.statuses);
  return currentStatuses.length === expectedStatuses.length
    && currentStatuses.every((status, index) => status === expectedStatuses[index]);
}

function normalizeRequestStatuses(statuses: readonly string[]) {
  return [...new Set(statuses)]
    .filter((status): status is RequestStatus =>
      REQUEST_STATUSES.includes(status as RequestStatus),
    )
    .sort();
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  RECEIVED: "접수중",
  CONSULTING: "진행중",
  SCHEDULED: "예약",
  REPAIRING: "입고기사수리",
  SHIPPED: "출고완료",
  ONSITE_COMPLETED: "현장완료",
  COMPANY_UNPAID: "미입금(회사)",
  PREVISIT_CANCELED: "방문전취소",
  ONSITE_CANCELED: "현장취소",
  INSHOP_CANCELED: "입고취소",
  TECH_PERSONAL_CALL: "개인처리콜(기사)",
  COMPANY_PERSONAL_CALL: "개인처리콜(회사)",
  COMPLETED: "완료(기존)",
  ON_HOLD: "보류",
  CANCELED: "취소(기존)",
};

export const ADMIN_OPERATIONAL_STATUSES = [
  "RECEIVED",
  "CONSULTING",
  "REPAIRING",
  "SHIPPED",
  "ONSITE_COMPLETED",
  "SCHEDULED",
  "COMPANY_UNPAID",
  "PREVISIT_CANCELED",
  "ONSITE_CANCELED",
  "INSHOP_CANCELED",
  "TECH_PERSONAL_CALL",
  "COMPANY_PERSONAL_CALL",
] as const satisfies readonly RequestStatus[];

export const STATUS_TRANSITIONS = Object.fromEntries(
  REQUEST_STATUSES.map((status) => [status, [...REQUEST_STATUSES]]),
) as Record<RequestStatus, RequestStatus[]>;

export const CUSTOMER_TYPES = ["신규일반고객", "재방문고객"] as const;
export const RECEIPT_TYPES = [
  "콜센터접수",
  "온라인접수",
  "오프라인접수",
  "기타접수",
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export const PAYMENT_METHODS = [
  "현금결제",
  "카드결제",
  "현금+카드",
  "현금+계좌",
  "계좌+카드",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SETTLEMENT_DEFAULT_STATUSES = [
  "SHIPPED",
  "ONSITE_COMPLETED",
  "COMPANY_UNPAID",
  "TECH_PERSONAL_CALL",
  "COMPANY_PERSONAL_CALL",
] as const satisfies readonly RequestStatus[];

export type Visibility = "PUBLIC" | "PRIVATE";

export type ServiceRequestRecord = {
  id: string;
  publicId: string;
  name: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
  regionPublic: string;
  deviceType: StoredDeviceType;
  manufacturerModel: string;
  symptom: string;
  description: string;
  visibility: Visibility;
  accessPasswordHash: string | null;
  lookupKey: string | null;
  status: RequestStatus;
  preferredAt: string | null;
  internalNote: string;
  notificationStatus: string;
  notificationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StatusHistoryRecord = {
  id: string;
  requestId: string;
  status: RequestStatus;
  publicNote: string;
  changedBy: string;
  createdAt: string;
};

export type CreateRequestInput = {
  name?: string;
  phone: string;
  address1: string;
  address2?: string;
  deviceType?: string;
  manufacturerModel?: string;
  symptom: string;
  description?: string;
  password?: string;
  privacyConsent?: boolean;
  website?: string;
};

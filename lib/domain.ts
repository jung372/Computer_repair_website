export const DEVICE_TYPES = ["desktop", "laptop", "monitor", "apple", "data-recovery", "other"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "컴퓨터",
  laptop: "노트북",
  monitor: "모니터",
  apple: "애플기기",
  "data-recovery": "데이터 복구",
  other: "기타기기",
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
export const PAYMENT_METHODS = ["현금 결제", "현금영수증 결제", "카드 결제"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  deviceType: DeviceType;
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
  deviceType: string;
  manufacturerModel?: string;
  symptom: string;
  description: string;
  password: string;
  privacyConsent: boolean;
  website?: string;
};

export const DEVICE_TYPES = ["desktop", "laptop", "monitor", "apple", "other"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "컴퓨터",
  laptop: "노트북",
  monitor: "모니터",
  apple: "애플기기",
  other: "기타기기",
};

export const REQUEST_STATUSES = [
  "RECEIVED",
  "CONSULTING",
  "SCHEDULED",
  "REPAIRING",
  "COMPLETED",
  "ON_HOLD",
  "CANCELED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  RECEIVED: "접수완료",
  CONSULTING: "상담중",
  SCHEDULED: "방문·입고예정",
  REPAIRING: "수리중",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELED: "취소",
};

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  RECEIVED: ["RECEIVED", "CONSULTING", "CANCELED"],
  CONSULTING: ["CONSULTING", "SCHEDULED", "ON_HOLD", "CANCELED"],
  SCHEDULED: ["SCHEDULED", "REPAIRING", "ON_HOLD", "CANCELED"],
  REPAIRING: ["REPAIRING", "COMPLETED", "ON_HOLD"],
  COMPLETED: ["COMPLETED", "REPAIRING"],
  ON_HOLD: ["ON_HOLD", "CONSULTING", "SCHEDULED", "CANCELED"],
  CANCELED: ["CANCELED", "CONSULTING"],
};

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
  name: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
  deviceType: string;
  manufacturerModel?: string;
  symptom: string;
  description: string;
  visibility: string;
  password?: string;
  preferredAt?: string;
  privacyConsent: boolean;
  website?: string;
};

export type PublicRequestSummary = {
  publicId: string;
  maskedName: string;
  regionPublic: string;
  deviceType: DeviceType;
  symptom: string;
  visibility: Visibility;
  status: RequestStatus;
  createdAt: string;
};

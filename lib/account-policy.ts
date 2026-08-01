export const ADMIN_LOGIN_NAME = "admin";
export const ACCOUNT_ROLES = ["OWNER", "STAFF"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

const STAFF_LOGIN_PATTERN = /^[a-z0-9._-]{3,30}$/;
const STAFF_PASSWORD_PATTERN = /^\d{4,64}$/;

export function normalizeLoginName(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 30) : "";
}

export function isValidStaffLoginName(value: string) {
  return STAFF_LOGIN_PATTERN.test(value) && value !== ADMIN_LOGIN_NAME;
}

export function isValidStaffPassword(value: string) {
  return STAFF_PASSWORD_PATTERN.test(value);
}

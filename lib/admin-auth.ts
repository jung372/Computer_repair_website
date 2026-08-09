import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPrimaryAdmin,
  getAdminAccountById,
  getAdminAccountByLoginName,
  getPrimaryAdmin,
  markAdminLogin,
  type AdminRecord,
} from "@/data/admin-repository";
import {
  ADMIN_LOGIN_NAME,
  normalizeLoginName,
  type AccountRole,
} from "@/lib/account-policy";
import { constantTimeEqualStrings } from "@/lib/security/constant-time";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { getRuntimeString, isDevelopment } from "./runtime-config";

export type AdminUser = {
  id: string;
  loginName: string;
  displayName: string;
  role: AccountRole;
  sessionVersion: number;
};

export const ADMIN_SESSION_COOKIE = "combaksa_admin_session";
export const LEGACY_ADMIN_SESSION_COOKIE = "baroon_admin_session";
export const LAST_LOGIN_COOKIE = "combaksa_last_login_id";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export async function getAdminUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const payload = await verifyAdminSessionToken(token);
  if (!payload) return null;
  const account = await getAdminAccountById(payload.adminId);
  if (
    !account ||
    !account.isActive ||
    account.sessionVersion !== payload.sessionVersion
  ) {
    return null;
  }
  return toAdminUser(account);
}

export async function requireAdmin(returnTo: string): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) {
    redirect(`/admin/login?returnTo=${encodeURIComponent(safeAdminReturnPath(returnTo))}`);
  }
  return user;
}

export async function requireOwner(returnTo: string): Promise<AdminUser> {
  const user = await requireAdmin(returnTo);
  if (user.role !== "OWNER") redirect("/admin/denied");
  return user;
}

export function adminSignInPath() {
  return "/admin/login?returnTo=%2Fadmin";
}

export async function authenticateAdminCredentials(
  loginNameValue: string,
  password: string,
  clientHash: string,
) {
  const loginName = normalizeLoginName(loginNameValue);
  let account = await getAdminAccountByLoginName(loginName);
  if (!account && loginName === ADMIN_LOGIN_NAME && !(await getPrimaryAdmin())) {
    const legacy = getRuntimeString("ADMIN_PASSWORD");
    if (!legacy || !password || !(await constantTimeEqualStrings(password, legacy))) return null;
    try {
      account = await createPrimaryAdmin(await hashPassword(password), clientHash);
    } catch {
      account = await getPrimaryAdmin();
    }
  }
  if (!account?.isActive || !(await verifyPassword(password, account.passwordHash))) return null;
  await markAdminLogin(account.id, clientHash);
  return account;
}

export async function createAdminSessionToken(admin: AdminRecord) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = `${admin.id}.${expires}.${admin.sessionVersion}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAdminSessionToken(token?: string) {
  if (!token) return null;
  const [adminId, expiresValue, sessionVersionValue, provided] = token.split(".");
  const expires = Number(expiresValue);
  const sessionVersion = Number(sessionVersionValue);
  if (
    !adminId ||
    !expires ||
    !sessionVersion ||
    !provided ||
    expires < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  const expected = await sign(`${adminId}.${expires}.${sessionVersion}`);
  if (!(await constantTimeEqualStrings(expected, provided))) return null;
  return { adminId, expires, sessionVersion };
}

export function safeAdminReturnPath(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (value.startsWith("/admin/login") || value.startsWith("/admin/setup")) return "/admin";
  return value;
}

function toAdminUser(account: AdminRecord): AdminUser {
  return {
    id: account.id,
    loginName: account.loginName,
    displayName: account.displayName,
    role: account.role,
    sessionVersion: account.sessionVersion,
  };
}

async function sign(payload: string) {
  const secret =
    getRuntimeString("ADMIN_SESSION_SECRET") ||
    (isDevelopment() ? "local-admin-session-secret" : "");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))),
  );
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

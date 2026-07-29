import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPrimaryAdmin,
  getPrimaryAdmin,
  markAdminLogin,
  type AdminRecord,
} from "@/data/admin-repository";
import { constantTimeEqualStrings } from "@/lib/security/constant-time";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { getRuntimeString, isDevelopment } from "./runtime-config";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  sessionVersion: number;
};

export const ADMIN_SESSION_COOKIE = "combaksa_admin_session";
export const LEGACY_ADMIN_SESSION_COOKIE = "baroon_admin_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export async function getAdminUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const payload = await verifyAdminSessionToken(token);
  if (!payload) return null;
  const admin = await getPrimaryAdmin();
  if (
    !admin ||
    !admin.isActive ||
    admin.id !== payload.adminId ||
    admin.sessionVersion !== payload.sessionVersion
  ) {
    return null;
  }
  return toAdminUser(admin);
}

export async function requireAdmin(returnTo: string): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) {
    redirect(`/admin/login?returnTo=${encodeURIComponent(safeAdminReturnPath(returnTo))}`);
  }
  return user;
}

export function adminSignInPath() {
  return "/admin/login?returnTo=%2Fadmin";
}

export async function authenticateAdminPassword(password: string, clientHash: string) {
  let admin = await getPrimaryAdmin();
  if (!admin) {
    const legacy = getRuntimeString("ADMIN_PASSWORD");
    if (!legacy || !password || !(await constantTimeEqualStrings(password, legacy))) return null;
    try {
      admin = await createPrimaryAdmin(await hashPassword(password), clientHash);
    } catch {
      admin = await getPrimaryAdmin();
    }
  }
  if (!admin?.isActive || !(await verifyPassword(password, admin.passwordHash))) return null;
  await markAdminLogin(admin.id, clientHash);
  return admin;
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

function toAdminUser(admin: AdminRecord): AdminUser {
  return {
    id: admin.id,
    email: admin.loginName,
    displayName: "운영자",
    sessionVersion: admin.sessionVersion,
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

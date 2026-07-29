import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { constantTimeEqualStrings } from "./security/constant-time";
import { getRuntimeString, isDevelopment } from "./runtime-config";

export type AdminUser = { email: string; displayName: string };

export const ADMIN_SESSION_COOKIE = "baroon_admin_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export async function getAdminUser(): Promise<AdminUser | null> {
  if (isDevelopment() && !getRuntimeString("ADMIN_PASSWORD")) {
    return { email: "local-admin", displayName: "로컬 관리자" };
  }
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await verifyAdminSessionToken(token))) return null;
  return { email: "admin", displayName: "운영자" };
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

export async function verifyAdminPassword(password: string) {
  const expected = getRuntimeString("ADMIN_PASSWORD");
  if (!expected || !password) return false;
  return constantTimeEqualStrings(password, expected);
}

export async function createAdminSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  return `${expires}.${await sign(`admin.${expires}`)}`;
}

export async function verifyAdminSessionToken(token?: string) {
  if (!token) return false;
  const [expiresValue, provided] = token.split(".");
  const expires = Number(expiresValue);
  if (!expires || !provided || expires < Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqualStrings(await sign(`admin.${expires}`), provided);
}

export function safeAdminReturnPath(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

async function sign(payload: string) {
  const secret =
    getRuntimeString("ADMIN_SESSION_SECRET") ||
    (isDevelopment() ? "local-admin-session-secret" : "");
  if (!secret) return "";
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

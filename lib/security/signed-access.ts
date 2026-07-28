import { getRuntimeString, isDevelopment } from "../runtime-config";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(payload: string) {
  const configured = getRuntimeString("REQUEST_ACCESS_SECRET");
  const secret = configured || (isDevelopment() ? "local-preview-secret-change-me" : "");
  if (!secret) throw new Error("REQUEST_ACCESS_SECRET is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

export async function createAccessToken(publicId: string, lifetimeSeconds = 600) {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const payload = `${publicId}.${expires}`;
  return `${expires}.${await signature(payload)}`;
}

export async function verifyAccessToken(publicId: string, token?: string) {
  if (!token) return false;
  const [expiresValue, provided] = token.split(".");
  const expires = Number(expiresValue);
  if (!expires || !provided || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = await signature(`${publicId}.${expires}`);
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

export function accessCookieName(publicId: string) {
  return `request_access_${publicId.replaceAll("-", "_")}`;
}

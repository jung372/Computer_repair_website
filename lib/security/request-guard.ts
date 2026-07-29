import { getRuntimeString, isDevelopment } from "@/lib/runtime-config";
import { hmacSha256, lengthDelimited } from "@/lib/security/keyed-hash";
import { normalizePhone } from "@/lib/security/lookup-key";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  if (
    (origin && origin !== expected) ||
    (!origin && (!referer || new URL(referer).origin !== expected))
  ) {
    throw new Error("INVALID_ORIGIN");
  }
}

export async function hashClientAddress(request: Request) {
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return hmacSha256(
    rateLimitSecret(),
    lengthDelimited([
      ["version", "v1"],
      ["scope", "client-ip"],
      ["value", address],
    ]),
  );
}

export function hashLookupPhone(phone: string) {
  return hmacSha256(
    rateLimitSecret(),
    lengthDelimited([
      ["version", "v1"],
      ["scope", "lookup-phone"],
      ["value", normalizePhone(phone)],
    ]),
  );
}

function rateLimitSecret() {
  const configured = getRuntimeString("RATE_LIMIT_SECRET");
  if (configured) return configured;
  if (isDevelopment()) return "local-rate-limit-secret-change-me";
  throw new Error("RATE_LIMIT_SECRET_NOT_CONFIGURED");
}

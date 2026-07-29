import { normalizePhone } from "@/lib/phone";
import { getRuntimeString, isDevelopment } from "@/lib/runtime-config";
import { hmacSha256, lengthDelimited } from "@/lib/security/keyed-hash";

const DEVELOPMENT_LOOKUP_SECRET = "local-request-lookup-secret-change-me";

// Re-exported so existing importers keep a single normalization implementation.
export { normalizePhone };

export function getLookupSecret() {
  const secret = getRuntimeString("REQUEST_LOOKUP_SECRET");
  if (secret) return secret;
  if (isDevelopment()) return DEVELOPMENT_LOOKUP_SECRET;
  throw new Error("REQUEST_LOOKUP_SECRET_NOT_CONFIGURED");
}

export async function createLookupKey(phone: string, password: string) {
  return hmacSha256(
    getLookupSecret(),
    lengthDelimited([
      ["version", "v1"],
      ["phone", normalizePhone(phone)],
      ["password", password],
    ]),
  );
}

export async function createLookupSecretCheck() {
  return hmacSha256(getLookupSecret(), "combaksa:lookup-secret-check:v1");
}

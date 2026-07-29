import { ensureDatabase, getD1 } from "@/data/database";
import { createLookupSecretCheck } from "@/lib/security/lookup-key";
import { constantTimeEqualStrings } from "@/lib/security/constant-time";

const LOOKUP_SECRET_CHECK_KEY = "request_lookup_secret_check";

export async function assertLookupSecretReady() {
  await ensureDatabase();
  const db = getD1();
  const expected = await createLookupSecretCheck();
  let setting = await db
    .prepare("SELECT value FROM security_settings WHERE key = ?")
    .bind(LOOKUP_SECRET_CHECK_KEY)
    .first<{ value: string }>();

  if (!setting) {
    const keyed = await db
      .prepare("SELECT 1 AS found FROM service_requests WHERE lookup_key IS NOT NULL LIMIT 1")
      .first<{ found: number }>();
    if (keyed) throw new Error("REQUEST_LOOKUP_SECRET_CHECK_MISSING");
    await db
      .prepare(
        "INSERT OR IGNORE INTO security_settings (key, value, updated_at) VALUES (?, ?, ?)",
      )
      .bind(LOOKUP_SECRET_CHECK_KEY, expected, new Date().toISOString())
      .run();
    setting = await db
      .prepare("SELECT value FROM security_settings WHERE key = ?")
      .bind(LOOKUP_SECRET_CHECK_KEY)
      .first<{ value: string }>();
  }

  if (!setting || !constantTimeEqualStrings(setting.value, expected)) {
    throw new Error("REQUEST_LOOKUP_SECRET_MISMATCH");
  }
}

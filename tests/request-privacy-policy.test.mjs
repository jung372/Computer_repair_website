import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateLookupCode } from "../lib/security/generated-lookup-code.ts";

const root = new URL("../", import.meta.url);

test("generates high-entropy lookup codes in a human-readable format", () => {
  const codes = new Set(Array.from({ length: 200 }, () => generateLookupCode()));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){2}$/);
});

test("makes description, password and consent interaction optional", async () => {
  const [form, service, api] = await Promise.all([
    readFile(new URL("components/request-form.tsx", root), "utf8"),
    readFile(new URL("lib/logic/request-service.ts", root), "utf8"),
    readFile(new URL("app/api/requests/route.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(form, /name="description"[\s\S]{0,180}required/);
  assert.doesNotMatch(form, /name="password"[\s\S]{0,220}required/);
  assert.doesNotMatch(form, /name="privacyConsent"|type="checkbox"/);
  assert.match(service, /generatedLookupCode = submittedPassword \? null : generateLookupCode\(\)/);
  assert.doesNotMatch(service, /fields\.privacyConsent/);
  assert.match(api, /generatedLookupCode/);
  assert.match(api, /"Cache-Control": "private, no-store"/);
});

test("limits owner Telegram PII and protects and expires the message", async () => {
  const [telegram, worker, migration, wrangler] = await Promise.all([
    readFile(new URL("infrastructure/telegram.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("drizzle/0009_request_privacy_telegram.sql", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
  ]);

  assert.match(telegram, /getChat/);
  assert.match(telegram, /payload\.result\.type === "private"/);
  assert.match(telegram, /protect_content: protectContent/);
  assert.match(telegram, /TELEGRAM_PII_RETENTION_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(telegram, /deleteMessage/);
  assert.match(telegram, /sha256\(chatId\)/);
  assert.doesNotMatch(telegram, /lookupCredential|generatedLookupCode|accessPasswordHash/);
  assert.match(worker, /deleteExpiredTelegramNotifications/);
  assert.match(migration, /telegram_delete_after/);
  assert.match(migration, /privacy_legal_basis/);
  assert.match(wrangler, /"TELEGRAM_CONTENT_PROTECTION_ENABLED": "true"/);
});

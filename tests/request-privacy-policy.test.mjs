import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("makes device, description, password and consent interaction optional", async () => {
  const [form, service, api] = await Promise.all([
    readFile(new URL("components/request-form.tsx", root), "utf8"),
    readFile(new URL("lib/logic/request-service.ts", root), "utf8"),
    readFile(new URL("app/api/requests/route.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(form, /name="description"[\s\S]{0,180}required/);
  assert.doesNotMatch(form, /name="password"[\s\S]{0,220}required/);
  assert.doesNotMatch(form, /name="deviceType"[\s\S]{0,180}required/);
  assert.doesNotMatch(form, /name="privacyConsent"|type="checkbox"/);
  assert.match(form, /입력 정보는 접수에 사용합니다/);
  assert.match(form, /aria-label="개인정보 처리방침 새 창에서 열기"/);
  assert.match(service, /UNSPECIFIED_DEVICE_TYPE/);
  assert.match(service, /if \(submittedPassword\) \{/);
  assert.match(service, /let accessPasswordHash: string \| null = null/);
  assert.doesNotMatch(service, /generateLookupCode|generatedLookupCode/);
  assert.doesNotMatch(service, /fields\.privacyConsent/);
  assert.doesNotMatch(api, /generatedLookupCode/);
  assert.match(api, /"Cache-Control": "private, no-store"/);
});

test("keeps provider names out of the ordinary customer journey", async () => {
  const customerFiles = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/request-form.tsx", root), "utf8"),
    readFile(new URL("components/request-lookup-form.tsx", root), "utf8"),
    readFile(new URL("components/private-unlock.tsx", root), "utf8"),
    readFile(new URL("app/requests/page.tsx", root), "utf8"),
  ]);

  for (const contents of customerFiles) assert.doesNotMatch(contents, /Telegram|텔레그램/);
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

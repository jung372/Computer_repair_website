import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the repair-service product instead of the starter preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /멈춘 컴퓨터/);
  assert.match(page, /서비스 신청/);
  assert.match(layout, /lang="ko"/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("includes durable requests, private access, admin and Telegram surfaces", async () => {
  const [schema, wrangler, requestApi, unlockApi, adminApi, adminSession, telegram] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("app/api/requests/route.ts", root), "utf8"),
    readFile(new URL("app/api/requests/[publicId]/unlock/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/requests/[publicId]/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/session/route.ts", root), "utf8"),
    readFile(new URL("infrastructure/telegram.ts", root), "utf8"),
  ]);

  assert.match(wrangler, /"binding": "DB"/);
  assert.match(wrangler, /baroon-computer-repair-db/);
  assert.match(schema, /service_requests/);
  assert.match(schema, /notification_outbox/);
  assert.match(requestApi, /createServiceRequest/);
  assert.match(unlockApi, /createAccessToken/);
  assert.match(adminApi, /getAdminUser/);
  assert.match(adminSession, /createAdminSessionToken/);
  assert.match(telegram, /sendMessage/);
});

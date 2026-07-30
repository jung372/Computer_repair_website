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

test("includes durable private requests, personal lookup, admin and Telegram surfaces", async () => {
  const [
    schema,
    wrangler,
    requestApi,
    lookupApi,
    unlockApi,
    adminApi,
    adminSession,
    adminSetup,
    adminPassword,
    telegram,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("app/api/requests/route.ts", root), "utf8"),
    readFile(new URL("app/api/requests/lookup/route.ts", root), "utf8"),
    readFile(new URL("app/api/requests/[publicId]/unlock/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/requests/[publicId]/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/session/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/setup/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/password/route.ts", root), "utf8"),
    readFile(new URL("infrastructure/telegram.ts", root), "utf8"),
  ]);

  assert.match(wrangler, /"binding": "DB"/);
  assert.match(wrangler, /baroon-computer-repair-db/);
  assert.match(schema, /service_requests/);
  assert.match(schema, /notification_outbox/);
  assert.match(schema, /customer_lookup_sessions/);
  assert.match(schema, /security_settings/);
  assert.match(schema, /admin_audit_logs/);
  assert.match(requestApi, /createServiceRequest/);
  assert.match(requestApi, /createCustomerLookupSession/);
  assert.match(lookupApi, /authenticateCustomerLookup/);
  assert.match(lookupApi, /combaksa_request_lookup|CUSTOMER_LOOKUP_COOKIE/);
  assert.match(unlockApi, /createAccessToken/);
  assert.match(adminApi, /getAdminUser/);
  assert.match(adminSession, /createAdminSessionToken/);
  assert.match(adminSetup, /createPrimaryAdmin/);
  assert.match(adminPassword, /changePrimaryAdminPassword/);
  assert.match(telegram, /sendMessage/);
});

test("delivers Telegram notifications off the response path and retries them on a schedule", async () => {
  const [requestApi, workerEntry, wrangler] = await Promise.all([
    readFile(new URL("app/api/requests/route.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
  ]);

  // The customer must not wait for Telegram before receiving a receipt number.
  assert.match(requestApi, /waitUntil\(processPendingNotifications\(/);
  assert.doesNotMatch(requestApi, /await processPendingNotifications\(/);
  assert.match(workerEntry, /async scheduled\(/);
  assert.match(workerEntry, /processPendingNotifications\(/);
  // The backup shares the crons array now, so check that the retry schedule is
  // present rather than pinning the array's formatting.
  assert.match(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(wrangler, /"TELEGRAM_NOTIFICATION_ENABLED": "true"/);
  assert.match(wrangler, /"PUBLIC_BASE_URL"/);
});

test("backs up D1 into R2 on its own daily schedule", async () => {
  const [workerEntry, backup, wrangler, localScript] = await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("infrastructure/backup.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("tools/backup-local.bat", root), "utf8"),
  ]);

  // Both schedules share one handler, so it must dispatch on the cron string;
  // otherwise the backup runs every five minutes or never runs at all.
  assert.match(wrangler, /"0 18 \* \* \*"/);
  assert.match(workerEntry, /const BACKUP_CRON = "0 18 \* \* \*"/);
  assert.match(workerEntry, /controller\.cron === BACKUP_CRON/);
  assert.match(workerEntry, /runDailyBackup\(\)/);

  assert.match(wrangler, /"binding": "BACKUPS"/);
  assert.match(wrangler, /"bucket_name": "combaksa-computer-repair-backups"/);

  // The table list is read from the database so a new migration cannot silently
  // fall out of the backup.
  assert.match(backup, /FROM sqlite_master/);
  assert.doesNotMatch(backup, /service_requests/);
  // One batch is one transaction, which is what makes the snapshot consistent.
  assert.match(backup, /db\.batch</);
  // Retention belongs to the bucket lifecycle rule, not to Worker delete calls.
  assert.doesNotMatch(backup, /\.delete\(/);

  // R2 shares the Cloudflare account with D1, so an offsite copy must exist too.
  assert.match(localScript, /wrangler d1 export/);
});

test("removes public request discovery and postal code collection from customer UI", async () => {
  const [home, lookupPage, requestForm, requestService, privacy, header, footer] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/requests/page.tsx", root), "utf8"),
    readFile(new URL("components/request-form.tsx", root), "utf8"),
    readFile(new URL("lib/logic/request-service.ts", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("components/site-header.tsx", root), "utf8"),
    readFile(new URL("components/site-footer.tsx", root), "utf8"),
  ]);

  assert.doesNotMatch(home, /RequestList|최근 신청 현황|전체 신청 현황/);
  assert.match(home, /내 신청 조회/);
  assert.match(lookupPage, /RequestLookupForm/);
  assert.doesNotMatch(lookupPage, /getPublicBoard|REQUEST_STATUSES|board-search/);
  assert.doesNotMatch(requestForm, /name="postalCode"|공개 범위|value="PUBLIC"/);
  assert.match(requestForm, /minLength=\{4\}/);
  assert.match(requestForm, /maxLength=\{20\}/);
  assert.match(requestForm, /미입력 시 미상으로 저장/);
  assert.doesNotMatch(requestForm, /label="이름 \*"/);
  assert.doesNotMatch(requestForm, /label="상세 주소 \*"/);
  assert.match(requestService, /clean\(values\.name, 30\) \|\| "미상"/);
  assert.doesNotMatch(requestService, /fields\.address2/);
  assert.doesNotMatch(privacy, /필수: 이름, 연락처, 우편번호/);
  assert.match(`${header}\n${footer}`, /내 신청 조회/);
});

test("provides an admin operations ledger, filters, stable serials and editable details", async () => {
  const [adminPage, detailPage, recordForm, repository, schema, migration] =
    await Promise.all([
      readFile(new URL("app/admin/page.tsx", root), "utf8"),
      readFile(new URL("app/admin/requests/[publicId]/page.tsx", root), "utf8"),
      readFile(new URL("components/admin-request-record-form.tsx", root), "utf8"),
      readFile(new URL("data/admin-request-repository.ts", root), "utf8"),
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("drizzle/0002_admin_operations.sql", root), "utf8"),
    ]);

  assert.match(adminPage, /접수내역 검색/);
  assert.match(adminPage, /번호[\s\S]*접수구분[\s\S]*고객명[\s\S]*휴대폰[\s\S]*담당자[\s\S]*고객구분[\s\S]*처리상태[\s\S]*접수일/);
  assert.match(adminPage, /integratedFrom/);
  assert.match(adminPage, /AdminStatusFilter/);
  assert.match(detailPage, /AdminRequestRecordForm/);
  assert.match(recordForm, /계산서 발행일자/);
  assert.match(recordForm, /관리자메모/);
  assert.match(recordForm, /사무실입금액/);
  assert.match(repository, /ORDER BY serial\.serial_no DESC/);
  assert.match(schema, /request_serials/);
  assert.match(schema, /request_operations/);
  assert.match(migration, /AUTOINCREMENT/);
});

test("pins the business contact and creates the D1 migration", async () => {
  const [siteConfig, wrangler, migration] = await Promise.all([
    readFile(new URL("lib/site-config.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("drizzle/0001_private_lookup_admin.sql", root), "utf8"),
  ]);

  assert.match(siteConfig, /010-3388-1597/);
  assert.match(wrangler, /010-3388-1597/);
  assert.match(migration, /ADD COLUMN `lookup_key`/);
  assert.match(migration, /CREATE TABLE `customer_lookup_sessions`/);
  assert.match(migration, /CREATE TABLE `admins`/);
});

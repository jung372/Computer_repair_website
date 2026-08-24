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
  assert.match(adminPassword, /changeAccountPassword/);
  assert.match(telegram, /sendMessage/);
});

test("starts the mobile request form above the fold and collapses optional fields", async () => {
  const [page, form, css] = await Promise.all([
    readFile(new URL("app/requests/new/page.tsx", root), "utf8"),
    readFile(new URL("components/request-form.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /className="form-page-side"/);
  assert.match(form, /약 2분이면 신청 완료/);
  assert.match(form, /className="optional-section-toggle"/);
  assert.match(form, /aria-expanded=\{optionalOpen\}/);
  assert.ok(form.indexOf('name="name"') < form.indexOf('name="phone"'));
  assert.ok(form.indexOf('name="symptom"') < form.indexOf('name="password"'));
  assert.ok(form.indexOf('className="optional-form-section"') < form.indexOf('name="deviceType"'));
  assert.ok(form.indexOf('name="address1"') < form.indexOf('name="address2"'));
  assert.doesNotMatch(form, /name="deviceType"[\s\S]{0,180}required/);
  assert.match(form, /field-mobile-inline/);
  assert.match(css, /@media \(max-width: 840px\)[\s\S]*?\.form-page-side\s*\{\s*display: none/);
  assert.match(css, /body:has\(\.form-page\) \.mobile-actions\s*\{\s*display: none/);
  assert.match(css, /\.optional-form-content\.is-open\s*\{\s*display: block/);
  assert.match(css, /\.form-intro-mobile-copy\s*\{[\s\S]*?display: flex/);
  assert.match(css, /\.field-mobile-inline\s*\{[\s\S]*?grid-template-columns: 88px minmax\(0, 1fr\)/);
});

test("supports fixed staff slots, copyable Telegram text and workload counts", async () => {
  const [schema, migration, telegram, staffRepository, staffPage, adminPage] =
    await Promise.all([
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("drizzle/0007_staff_slots_telegram.sql", root), "utf8"),
      readFile(new URL("infrastructure/telegram.ts", root), "utf8"),
      readFile(new URL("data/staff-slot-repository.ts", root), "utf8"),
      readFile(new URL("app/admin/staff/page.tsx", root), "utf8"),
      readFile(new URL("app/admin/page.tsx", root), "utf8"),
    ]);

  assert.match(schema, /staffSlots/);
  assert.match(schema, /requestAssignmentHistory/);
  assert.match(migration, /직원 슬롯 1/);
  assert.match(migration, /직원 슬롯 2/);
  assert.match(migration, /직원 슬롯 3/);
  assert.match(migration, /DELETE FROM `admins` WHERE `role` = 'STAFF'/);
  assert.match(telegram, /TELEGRAM_CONTENT_PROTECTION_ENABLED/);
  assert.match(telegram, /`기본주소: \$\{request\.address1\}`/);
  assert.match(telegram, /`휴대폰: \$\{request\.phone\}`/);
  assert.match(telegram, /`기본 증상: \$\{request\.symptom\.slice/);
  assert.doesNotMatch(telegram, /`신청자: \$\{request\.name\}`/);
  assert.doesNotMatch(telegram, /request\.address2|request\.description/);
  assert.match(staffRepository, /permanentlyDeleteUnusedStaff/);
  assert.match(staffRepository, /getStaffTelegramRecipient/);
  assert.match(staffPage, /직원 영구 삭제/);
  assert.match(adminPage, /담당자 미배정/);
  assert.match(adminPage, /총 미종결/);
  assert.match(adminPage, /내 미종결/);
  assert.doesNotMatch(adminPage, /총 미접수|내 미접수/);
  assert.match(adminPage, /DashboardCard/);
  assert.match(adminPage, /buildAdminDashboardFilterHref/);
  assert.match(adminPage, /aria-current/);
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
  assert.match(workerEntry, /deleteExpiredTelegramNotifications\(/);
  // The backup shares the crons array now, so check that the retry schedule is
  // present rather than pinning the array's formatting.
  assert.match(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(wrangler, /"TELEGRAM_NOTIFICATION_ENABLED": "true"/);
  assert.match(wrangler, /"TELEGRAM_CONTENT_PROTECTION_ENABLED": "true"/);
  assert.match(wrangler, /"TELEGRAM_PII_MODE": "FULL"/);
  assert.match(wrangler, /"PUBLIC_BASE_URL"/);
});

test("backs up D1 into R2 on its own daily schedule", async () => {
  const [workerEntry, backup, wrangler, localScript, serverSync, serverSetup, restoreScript] =
    await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("infrastructure/backup.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("tools/backup-local.bat", root), "utf8"),
    readFile(new URL("tools/server-backup/sync-r2-backups.ps1", root), "utf8"),
    readFile(new URL("tools/server-backup/setup-backup-task.ps1", root), "utf8"),
    readFile(new URL("tools/server-backup/restore-backup.ps1", root), "utf8"),
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
  // The server must be able to reject a truncated or altered offsite copy.
  assert.match(backup, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(backup, /customMetadata: \{ sha256 \}/);
  assert.match(backup, /`\$\{BACKUP_PREFIX\}\/\$\{backupDate\}\.json`/);
  // Retention belongs to the bucket lifecycle rule, not to Worker delete calls.
  assert.doesNotMatch(backup, /\.delete\(/);

  // R2 shares the Cloudflare account with D1, so an offsite copy must exist too.
  assert.match(localScript, /wrangler d1 export/);
  assert.match(serverSync, /wrangler\.cmd/);
  assert.match(serverSync, /Get-FileHash[\s\S]*SHA256/);
  assert.match(serverSync, /Protect-CmsMessage/);
  assert.match(serverSync, /Unprotect-CmsMessage/);
  assert.match(serverSync, /retentionDays -ne 365/);
  assert.match(serverSync, /maxBackupAgeHours/);
  assert.match(serverSetup, /Find-GoogleDriveRoot/);
  assert.match(serverSetup, /Protect-LocalRuntimeDirectory/);
  assert.match(serverSetup, /LocalFallbackRoot = 'D:\\SecureBackups\\ComputerRepair'/);
  assert.match(serverSetup, /retentionDays = 365/);
  assert.match(serverSetup, /maxBackupAgeHours = 30/);
  assert.match(restoreScript, /Unprotect-CmsMessage/);
  assert.match(restoreScript, /production D1 database was not modified/);
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
  const [adminPage, statusFilter, detailPage, recordForm, repository, schema, migration] =
    await Promise.all([
      readFile(new URL("app/admin/page.tsx", root), "utf8"),
      readFile(new URL("components/admin-status-filter.tsx", root), "utf8"),
      readFile(new URL("app/admin/requests/[publicId]/page.tsx", root), "utf8"),
      readFile(new URL("components/admin-request-record-form.tsx", root), "utf8"),
      readFile(new URL("data/admin-request-repository.ts", root), "utf8"),
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("drizzle/0002_admin_operations.sql", root), "utf8"),
    ]);

  assert.match(adminPage, /접수내역 검색/);
  assert.match(adminPage, /번호[\s\S]*접수구분[\s\S]*고객명[\s\S]*휴대폰[\s\S]*기본주소[\s\S]*담당자[\s\S]*고객구분[\s\S]*처리상태[\s\S]*접수일/);
  assert.match(adminPage, /integratedFrom/);
  assert.doesNotMatch(adminPage, /receivedFrom|receivedTo|completedFrom|completedTo/);
  assert.match(adminPage, /AdminStatusFilter/);
  assert.match(detailPage, /AdminRequestRecordForm/);
  assert.match(recordForm, /계산서 발행일자/);
  assert.match(recordForm, /관리자메모/);
  assert.match(repository, /ORDER BY serial\.serial_no DESC/);
  assert.match(repository, /COUNT\(\*\) AS total_count/);
  assert.match(repository, /LIMIT \? OFFSET \?/);
  assert.match(adminPage, /AdminPagination/);
  assert.match(adminPage, />이전</);
  assert.match(adminPage, />다음</);
  assert.match(statusFilter, /hiddenStatuses/);
  assert.match(statusFilter, /type="hidden" name="status"/);
  assert.match(schema, /request_serials/);
  assert.match(schema, /request_operations/);
  assert.match(migration, /AUTOINCREMENT/);
});

test("restores the controlled receipt type and derives settlement amounts on the server", async () => {
  const [adminPage, recordForm, recordService, recordRoute, repository, settlement] = await Promise.all([
    readFile(new URL("app/admin/page.tsx", root), "utf8"),
    readFile(new URL("components/admin-request-record-form.tsx", root), "utf8"),
    readFile(new URL("lib/logic/admin-record-service.ts", root), "utf8"),
    readFile(new URL("app/api/admin/requests/[publicId]/route.ts", root), "utf8"),
    readFile(new URL("data/admin-request-repository.ts", root), "utf8"),
    readFile(new URL("lib/settlement.ts", root), "utf8"),
  ]);

  assert.match(adminPage, /접수구분/);
  assert.match(recordForm, /label="접수구분 \*"/);
  assert.match(recordForm, /RECEIPT_TYPES\.map/);
  assert.match(recordForm, /label="고객접수구분"/);
  assert.match(recordService, /RECEIPT_TYPES\.includes/);
  assert.match(repository, /operations\.receipt_type/);
  assert.match(repository, /UPDATE request_operations\s+SET receipt_type = \?/);

  // 두 부가세·기사수익은 읽기 전용 표시이며 사무실입금액 입력란은 없다.
  assert.doesNotMatch(recordForm, /사무실입금액|admin-calculator-button|calculateSettlement/);
  assert.match(recordForm, /label="총수금액 부가세"/);
  assert.match(recordForm, /label="자재비 부가세"/);
  assert.match(recordForm, /label="기사수익"/);
  assert.match(recordForm, /deriveSettlement\(\s*paymentMethod,\s*amounts\.totalAmount,\s*amounts\.materialCost/);
  assert.match(recordForm, /hint="총수금액 ÷ 11"/);
  assert.match(recordForm, /PAYMENT_METHODS\.map/);
  assert.match(recordForm, /user\.role === "OWNER" \? \([\s\S]{0,200}<AmountField label="자재비"/);
  assert.match(recordForm, /hint="운영자만 입력·수정"/);

  // 서버가 클라이언트 값을 믿지 않고 다시 계산한다.
  assert.match(recordService, /deriveSettlement\(\s*paymentMethod as PaymentMethod \| "",\s*totalAmount,\s*materialCost/);
  assert.doesNotMatch(recordService, /values\.(?:totalVatAmount|materialVatAmount|technicianIncome|officeDeposit)/);
  assert.match(recordService, /자재비와 자재비 부가세의 합계/);
  assert.match(recordService, /PAYMENT_METHODS\.includes/);
  assert.match(recordService, /actor\.role !== "OWNER"[\s\S]{0,160}hasOwnProperty\.call\(values, "materialCost"\)/);
  assert.match(recordService, /actor\.role === "OWNER"[\s\S]{0,120}request\.materialCost/);
  assert.match(recordRoute, /AdminRecordAuthorizationError[\s\S]{0,180}status: 403/);
  assert.match(settlement, /VAT_DIVISOR = 11/);
  assert.match(settlement, /MATERIAL_VAT_DIVISOR = 10/);
});

test("separates owner and staff access, assignment, and login identity", async () => {
  const [
    loginPage,
    sessionRoute,
    auth,
    staffPage,
    staffService,
    staffRoute,
    adminPage,
    detailPage,
    recordForm,
    repository,
    schema,
    migration,
    cleanupMigration,
    css,
    layout,
    staffPhoneInput,
  ] = await Promise.all([
    readFile(new URL("app/admin/login/page.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/session/route.ts", root), "utf8"),
    readFile(new URL("lib/admin-auth.ts", root), "utf8"),
    readFile(new URL("app/admin/staff/page.tsx", root), "utf8"),
    readFile(new URL("lib/logic/staff-slot-service.ts", root), "utf8"),
    readFile(new URL("app/api/admin/staff/route.ts", root), "utf8"),
    readFile(new URL("app/admin/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/requests/[publicId]/page.tsx", root), "utf8"),
    readFile(new URL("components/admin-request-record-form.tsx", root), "utf8"),
    readFile(new URL("data/admin-request-repository.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0005_staff_accounts_assignment.sql", root), "utf8"),
    readFile(new URL("drizzle/0006_clear_legacy_assignee.sql", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("components/staff-phone-input.tsx", root), "utf8"),
  ]);

  assert.match(loginPage, /name="loginName"/);
  assert.match(loginPage, /LAST_LOGIN_COOKIE/);
  assert.match(sessionRoute, /authenticateAdminCredentials/);
  assert.match(sessionRoute, /admin-ip:/);
  assert.match(sessionRoute, /admin-account:/);
  assert.match(sessionRoute, /LAST_LOGIN_COOKIE/);
  assert.match(auth, /requireOwner/);
  assert.match(staffPage, /새 직원 계정/);
  assert.match(staffPage, /listStaffSlots/);
  assert.match(staffPage, /pattern="\[0-9\]\{4,64\}"/);
  assert.match(staffService, /normalizePhone\(raw\)/);
  assert.match(staffService, /formatPhone\(digits\)/);
  assert.match(staffRoute, /owner\.role !== "OWNER"/);
  assert.match(adminPage, /admin\.role === "STAFF" \? admin\.id/);
  assert.match(adminPage, /admin-request-card-list/);
  assert.match(adminPage, /상세보기 \/ 수정하기/);
  assert.match(adminPage, /staffAccounts\.map/);
  assert.match(adminPage, /InlineAssignmentForm/);
  assert.match(detailPage, /user\.role === "STAFF" \? user\.id/);
  assert.match(recordForm, /action: "assign"/);
  assert.match(recordForm, /href=\{returnTo\}/);
  assert.doesNotMatch(recordForm, /window\.location\.reload\(\)/);
  assert.match(repository, /operations\.assignee_account_id = \?/);
  assert.match(repository, /assignAdminRequest/);
  assert.match(schema, /assigneeAccountId/);
  assert.match(migration, /role` text DEFAULT 'STAFF'/);
  assert.match(migration, /login_name` = 'admin'/);
  assert.match(cleanupMigration, /WHERE `assignee` = '김규웅'/);
  assert.match(cleanupMigration, /`assignee_account_id` IS NULL/);
  assert.match(css, /\.admin-request-table-wrap\s*\{\s*display: none/);
  assert.match(css, /\.admin-request-card-list\s*\{\s*display: grid/);
  assert.match(css, /\.service-card-top\s*\{[\s\S]{0,160}margin-bottom: 6px/);
  assert.match(css, /\.service-icon\s*\{[\s\S]{0,160}position: absolute/);
  assert.match(layout, /applicationName: "컴박사"/);
  assert.match(layout, /siteName: "컴박사"/);
  assert.match(layout, /og\.png\?v=combaksa-202608/);
  assert.doesNotMatch(layout, /바로온 컴퓨터/);
  assert.match(staffPhoneInput, /formatPhoneInput/);
  assert.match(staffPhoneInput, /formatPhoneOnBlur/);
});

test("provides role-scoped monthly settlement reports and totals", async () => {
  const [page, repository, nav, migration, domain] = await Promise.all([
    readFile(new URL("app/admin/settlements/page.tsx", root), "utf8"),
    readFile(new URL("data/settlement-repository.ts", root), "utf8"),
    readFile(new URL("components/admin-account-nav.tsx", root), "utf8"),
    readFile(new URL("drizzle/0008_settlement_and_receipt_type.sql", root), "utf8"),
    readFile(new URL("lib/domain.ts", root), "utf8"),
  ]);

  assert.match(nav, /\/admin\/settlements/);
  assert.match(page, /금월/);
  assert.match(page, /총수금액/);
  assert.match(page, /자재비/);
  assert.match(page, /부가세/);
  assert.match(page, /수익금/);
  assert.match(page, /미수금/);
  assert.match(page, /admin\.role === "STAFF" \? admin\.id/);
  assert.match(repository, /operations\.assignee_account_id = \?/);
  assert.match(repository, /SUM\(operations\.technician_income\)/);
  assert.match(repository, /COMPANY_UNPAID/);
  assert.match(migration, /관리자접수/);
  assert.match(migration, /콜센터접수/);
  assert.match(domain, /RECEIPT_TYPES/);
  assert.match(domain, /SETTLEMENT_DEFAULT_STATUSES/);
});

test("lifts the description length cap and stops collecting a preferred visit time", async () => {
  const [requestForm, requestService, recordForm, recordService, detailPage, privacy] =
    await Promise.all([
      readFile(new URL("components/request-form.tsx", root), "utf8"),
      readFile(new URL("lib/logic/request-service.ts", root), "utf8"),
      readFile(new URL("components/admin-request-record-form.tsx", root), "utf8"),
      readFile(new URL("lib/logic/admin-record-service.ts", root), "utf8"),
      readFile(new URL("app/requests/[publicId]/page.tsx", root), "utf8"),
      readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    ]);

  // 상세 접수 내용에는 화면 제한이 없고, 서버 상한은 양쪽 폼이 같아야 한다.
  assert.doesNotMatch(requestForm, /name="description"[\s\S]{0,200}maxLength/);
  assert.doesNotMatch(requestForm, /name="description"[\s\S]{0,200}minLength/);
  assert.match(requestService, /DESCRIPTION_LIMIT = 20_000/);
  assert.doesNotMatch(requestService, /10자 이상/);
  assert.match(recordForm, /name="description"[\s\S]{0,120}maxLength=\{20000\}/);
  assert.match(recordService, /clean\(values\.description, 20_000\)/);

  // 희망 방문 일시는 폼·상세·처리방침에서 모두 사라진다.
  assert.doesNotMatch(requestForm, /preferredAt|희망 방문/);
  assert.doesNotMatch(detailPage, /preferredAt|희망 일정/);
  assert.doesNotMatch(privacy, /희망 방문 일시/);
  assert.match(requestService, /preferredAt: null/);
});

test("shows the registered business identity in the footer", async () => {
  // .env.example은 gitignore 대상이라 검사하지 않는다. 기본값은 코드에 있어야 한다.
  const [siteConfig, footer] = await Promise.all([
    readFile(new URL("lib/site-config.ts", root), "utf8"),
    readFile(new URL("components/site-footer.tsx", root), "utf8"),
  ]);

  assert.match(siteConfig, /389-80-03376/);
  assert.match(siteConfig, /김규웅/);
  assert.match(siteConfig, /서울특별시 광진구 자양로19길 42-17, 101호/);
  assert.match(footer, /사업자등록번호 \{config\.businessNumber\}/);
  assert.match(footer, /대표 \{config\.representative\}/);
  assert.match(footer, /\{config\.address\}/);
  assert.doesNotMatch(footer, /사업자 정보는 실제 운영 정보로 교체해 주세요/);
  assert.match(siteConfig, /NEXT_PUBLIC_BUSINESS_NUMBER/);
  assert.match(siteConfig, /NEXT_PUBLIC_BUSINESS_OWNER/);
  assert.match(siteConfig, /NEXT_PUBLIC_BUSINESS_ADDRESS/);
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

test("offers data recovery as a repair service category", async () => {
  const [domain, content, icon, css] = await Promise.all([
    readFile(new URL("lib/domain.ts", root), "utf8"),
    readFile(new URL("lib/service-content.ts", root), "utf8"),
    readFile(new URL("components/device-icon.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  // 드롭다운·검증·라벨이 모두 이 배열을 읽으므로 id가 빠지면 접수가 거부된다.
  assert.match(domain, /"data-recovery"/);
  assert.match(domain, /"data-recovery": "데이터 복구"/);
  // 기타기기는 드롭다운 마지막에 남아야 한다.
  assert.match(domain, /"data-recovery", "other"\] as const/);

  assert.match(content, /title: "데이터 복구"/);
  // 다섯 가지 복구 대상이 상세 페이지에서 사라지지 않아야 한다.
  for (const target of [/휴대폰/, /SD카드/, /블랙박스/, /하드·외장하드/, /SSD/]) {
    assert.match(content, target);
  }

  // 분기가 없으면 Wrench 폴백으로 조용히 떨어진다.
  assert.match(icon, /type === "data-recovery"/);

  // 다섯 번째 accent는 전용 색 램프가 있어야 기존 카드와 구분된다.
  assert.match(css, /--rose-600/);
  assert.match(css, /\.accent-rose \.service-icon/);
  assert.match(css, /\.device-page-hero\.accent-rose \.device-page-icon/);
  // .process-grid도 5열이라 선택자까지 묶어서 확인한다.
  assert.match(css, /\.service-grid \{[^}]*repeat\(5, 1fr\)/);
});

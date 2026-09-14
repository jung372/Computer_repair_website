import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

const CORE_NAME = "legacy-core";
const EDGE_NAME = "fixture-edge";
const VOX_SECRET = "fixture-vox-secret-with-sufficient-entropy";
const VOX_AGENT = "fixture-agent";

function bundleModules() {
  const entry = fileURLToPath(new URL("../dist/server/index.js", import.meta.url));
  const files = [];
  const visit = (directory) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && path.endsWith(".js")) files.push(path);
    }
  };
  visit(dirname(entry));
  return [entry, ...files.filter((path) => path !== entry)].map((path) => ({
    type: "ESModule",
    path,
  }));
}

async function createFixture() {
  const mf = new Miniflare({
    compatibilityDate: "2026-05-22",
    compatibilityFlags: ["nodejs_compat"],
    workers: [
      {
        name: CORE_NAME,
        compatibilityDate: "2026-05-22",
        compatibilityFlags: ["nodejs_compat"],
        modules: bundleModules(),
        d1Databases: ["DB"],
        r2Buckets: ["MARKETING_PHOTOS"],
        queueProducers: { MARKETING_JOBS: "fixture-marketing-jobs" },
        bindings: {
          NEW_CORE_ENABLED: "true",
          NEW_SITE_VOX_PROCESSING_ENABLED: "true",
          VOX_WEBHOOK_ENABLED: "true",
          LEGACY_VOX_PUBLIC_ENABLED: "true",
          VOX_WEBHOOK_SECRET: VOX_SECRET,
          VOX_AGENT_ID: VOX_AGENT,
          VOX_INBOUND_NUMBER: "07079175281",
          RATE_LIMIT_SECRET: "fixture-rate-limit-secret-with-sufficient-entropy",
          REQUEST_LOOKUP_SECRET: "fixture-request-lookup-secret-with-sufficient-entropy",
          ADMIN_SESSION_SECRET: "fixture-admin-session-secret-with-sufficient-entropy",
          NEXT_PUBLIC_NAVER_BLOG_ID: "combaksa_repair",
          TELEGRAM_NOTIFICATION_ENABLED: "false",
          PUBLIC_BASE_URL: "https://legacy.example.test",
          NEW_SITE_PUBLIC_BASE_URL: "https://new.example.test",
        },
      },
      {
        name: EDGE_NAME,
        compatibilityDate: "2026-05-22",
        compatibilityFlags: ["nodejs_compat"],
        modules: true,
        script: `export default {
          async fetch(request, env) {
            const incoming = new URL(request.url);
            const headers = new Headers(request.headers);
            headers.set("cf-connecting-ip", "192.0.2.44");
            return env.CORE_SERVICE.fetch(new Request(
              "https://new-site-core.internal" + incoming.pathname + incoming.search,
              { method: request.method, headers, body: request.body }
            ));
          }
        }`,
        serviceBindings: {
          CORE_SERVICE: { name: CORE_NAME, entrypoint: "NewSiteCore" },
        },
      },
    ],
  });
  const db = await mf.getD1Database("DB", CORE_NAME);
  const directory = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    const statements = readFileSync(new URL(name, directory), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await db.prepare(statement).run();
  }
  const edge = await mf.getWorker(EDGE_NAME);
  const core = await mf.getWorker(CORE_NAME);
  return { mf, db, edge, core };
}

function requestBody(overrides = {}) {
  return {
    phone: "01012345678",
    address1: "서울특별시 중구 세종대로 1",
    address2: "가상 테스트 주소",
    deviceType: "desktop",
    symptom: "가상 부팅 불량 테스트",
    description: "실제 고객 데이터가 아닌 통합 테스트입니다.",
    ...overrides,
  };
}

async function post(edge, path, body, key) {
  const headers = { "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  return edge.fetch(`https://fixture.test${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function encodedPassword(password) {
  const salt = new Uint8Array(16);
  salt.fill(7);
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  ));
  return `pbkdf2-sha256$v=1$i=100000$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

async function insertAdmin(db, {
  id,
  loginName,
  displayName,
  role,
  password,
}) {
  const now = "2026-09-09T00:00:00.000Z";
  await db.prepare(`INSERT INTO admins (
    id, login_name, password_hash, display_name, phone, role, created_by,
    slot_serial_no, is_active, session_version, password_changed_at,
    last_login_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, '', ?, NULL, NULL, 1, 1, ?, NULL, ?, ?)`)
    .bind(id, loginName, await encodedPassword(password), displayName, role, now, now, now)
    .run();
}

async function adminCookie(edge, loginName, password) {
  const response = await post(edge, "/v1/admin/session", { loginName, password });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  return setCookie.split(";", 1)[0];
}

function multipartBody(fields, file) {
  const boundary = "----combaksa-fixture-boundary";
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  if (file) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ));
    parts.push(Buffer.from(file.bytes));
    parts.push(Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function voxPayload(callId) {
  return {
    event: "call_analyzed",
    webhook_version: "v2",
    call: {
      call_id: callId,
      agent: { agent_id: VOX_AGENT, agent_version: "fixture-v1" },
      call_type: "inbound",
      from_number: "+82 10-9876-5432",
      to_number: "070-7917-5281",
      start_at: Date.now(),
      call_analysis: { custom_analysis_data: [
        { name: "privacy_notice_delivered", value: true },
        { name: "ai_identity_disclosed", value: true },
        { name: "service_request_confirmed", value: true },
        { name: "address_confirmed", value: true },
        { name: "address1", value: "서울특별시 광진구 가상로 1" },
        { name: "address2", value: "테스트 101호" },
        { name: "symptom", value: "가상 화면 불량" },
      ] },
    },
  };
}

async function signedVoxRequest(target, url, callId) {
  const rawBody = JSON.stringify(voxPayload(callId));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await webcrypto.subtle.importKey(
    "raw", new TextEncoder().encode(VOX_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = new Uint8Array(await webcrypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  const signature = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return target.fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-timestamp": timestamp,
      "x-webhook-signature": `sha256=${signature}`,
    },
    body: rawBody,
  });
}

test("bundled named entrypoint atomically handles parallel replay, conflict, and distinct same-phone requests", async () => {
  const { mf, db, edge } = await createFixture();
  try {
    const key = "fixture-submission-0001";
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post(edge, "/v1/requests", requestBody(), key)),
    );
    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => response.status === 200).length, 9);
    const payloads = await Promise.all(responses.map((response) => response.json()));
    assert.equal(new Set(payloads.map((payload) => payload.data.publicId)).size, 1);
    assert.equal(payloads.filter((payload) => payload.data.replayed).length, 9);
    const requestId = await db.prepare("SELECT id FROM service_requests WHERE public_id = ?")
      .bind(payloads[0].data.publicId).first();
    for (const [table, column] of [
      ["request_status_history", "request_id"],
      ["request_serials", "request_id"],
      ["request_operations", "request_id"],
      ["notification_outbox", "request_id"],
    ]) {
      const related = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
        .bind(requestId.id).first();
      assert.equal(related.count, 1, `${table} should contain exactly one logical write`);
    }

    const conflict = await post(edge, "/v1/requests", requestBody({ symptom: "다른 증상" }), key);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");

    const separate = await post(edge, "/v1/requests", requestBody(), "fixture-submission-0002");
    assert.equal(separate.status, 201);
    const count = await db.prepare(`
      SELECT COUNT(*) AS count FROM service_requests
      WHERE REPLACE(phone, '-', '') = '01012345678' AND source_site = 'new' AND source_channel = 'WEB'
    `).first();
    assert.equal(count.count, 2);

    const rssFailure = await post(edge, "/v1/blog/rss/status", { code: "FETCH_TIMEOUT" });
    assert.equal(rssFailure.status, 200);
    const syncState = await db.prepare("SELECT last_success_at, last_failure_at, last_error FROM blog_sync_state WHERE source = 'naver-rss'").first();
    assert.equal(syncState.last_success_at, null);
    assert.ok(syncState.last_failure_at);
    assert.equal(syncState.last_error, "FETCH_TIMEOUT");
  } finally {
    await mf.dispose();
  }
});

test("new customer endpoint rejects a token stored with legacy scope", async () => {
  const { mf, db, edge } = await createFixture();
  try {
    const created = await post(edge, "/v1/requests", requestBody(), "fixture-submission-0003");
    assert.equal(created.status, 201);
    const token = "legacy-token-copied-to-new-cookie";
    const digest = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("hex");
    const requestRow = await db.prepare("SELECT id FROM service_requests WHERE source_site = 'new' LIMIT 1").first();
    await db.prepare(`INSERT INTO customer_lookup_sessions
      (id, token_hash, expires_at, created_at, site_scope) VALUES (?, ?, ?, ?, 'legacy')`)
      .bind("legacy-session", digest, "2099-01-01T00:00:00.000Z", "2026-09-09T00:00:00.000Z").run();
    await db.prepare(`INSERT INTO customer_lookup_session_requests
      (session_id, request_id, created_at) VALUES (?, ?, ?)`)
      .bind("legacy-session", requestRow.id, "2026-09-09T00:00:00.000Z").run();
    const response = await edge.fetch("https://fixture.test/v1/customer/requests", {
      headers: { cookie: `combaksa_new_lookup_session=${token}` },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "AUTH_REQUIRED");
  } finally {
    await mf.dispose();
  }
});

test("customer detail requires a new-site link and direct unlock creates only a new-site session", async () => {
  const { mf, edge } = await createFixture();
  try {
    const created = await post(edge, "/v1/requests", requestBody({
      name: "가상고객",
      password: "2468",
    }), "fixture-submission-detail");
    assert.equal(created.status, 201);
    const { publicId } = (await created.json()).data;

    const locked = await edge.fetch(`https://fixture.test/v1/customer/requests/${publicId}`);
    assert.equal(locked.status, 401);

    const unlock = await post(
      edge,
      `/v1/customer/requests/${publicId}/unlock`,
      { password: "2468" },
    );
    assert.equal(unlock.status, 200);
    const setCookie = unlock.headers.get("set-cookie");
    assert.ok(setCookie?.startsWith("combaksa_new_lookup_session="));
    const sessionCookie = setCookie.split(";", 1)[0];

    const detail = await edge.fetch(`https://fixture.test/v1/customer/requests/${publicId}`, {
      headers: { cookie: sessionCookie },
    });
    assert.equal(detail.status, 200);
    const payload = await detail.json();
    assert.equal(payload.data.request.publicId, publicId);
    assert.equal(payload.data.request.maskedName, "가**");
    assert.equal(payload.data.request.maskedPhone, "010-****-5678");
    assert.ok(Array.isArray(payload.data.history));
    assert.doesNotMatch(JSON.stringify(payload), /서울특별시 중구 세종대로 1/);
    assert.doesNotMatch(JSON.stringify(payload), /01012345678/);

    const logout = await edge.fetch("https://fixture.test/v1/customer/session", {
      method: "DELETE",
      headers: { cookie: sessionCookie },
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
    const afterLogout = await edge.fetch(`https://fixture.test/v1/customer/requests/${publicId}`, {
      headers: { cookie: sessionCookie },
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await mf.dispose();
  }
});

test("setup remains non-bootstrapping while owner-only marketing and Vox APIs reuse core bindings", async () => {
  const { mf, db, edge } = await createFixture();
  try {
    const emptySetup = await edge.fetch("https://fixture.test/v1/admin/setup");
    assert.equal(emptySetup.status, 200);
    assert.deepEqual((await emptySetup.json()).data, { ownerExists: false, setupAllowed: false });

    await insertAdmin(db, {
      id: "primary",
      loginName: "admin",
      displayName: "운영자",
      role: "OWNER",
      password: "fixture-owner-password-123",
    });
    await insertAdmin(db, {
      id: "fixture-staff",
      loginName: "staff01",
      displayName: "가상직원",
      role: "STAFF",
      password: "2468",
    });
    const ownerCookie = await adminCookie(edge, "admin", "fixture-owner-password-123");
    const staffCookie = await adminCookie(edge, "staff01", "2468");

    const configuredSetup = await edge.fetch("https://fixture.test/v1/admin/setup");
    assert.deepEqual((await configuredSetup.json()).data, { ownerExists: true, setupAllowed: false });

    for (const path of ["/v1/admin/marketing/jobs", "/v1/admin/integrations/vox"]) {
      const anonymous = await edge.fetch(`https://fixture.test${path}`);
      assert.equal(anonymous.status, 401);
      const staff = await edge.fetch(`https://fixture.test${path}`, {
        headers: { cookie: staffCookie },
      });
      assert.equal(staff.status, 403);
    }

    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0,
    ]);
    const upload = multipartBody({
      symptom: "가상 수리 증상",
      causeUnknown: "on",
      actionsTaken: "가상 부품 교체",
      verificationResult: "가상 정상 동작 확인",
      district: "광진구",
      photoConsent: "on",
      privacyReviewed: "on",
      photoEvidenceNote: "가상 이미지에 개인정보 없음",
    }, { name: "fixture.png", type: "image/png", bytes: png });
    const submitHeaders = {
      cookie: ownerCookie,
      "idempotency-key": "fixture-marketing-0001",
      "content-type": upload.contentType,
      "content-length": String(upload.body.byteLength),
    };
    const submitted = await edge.fetch("https://fixture.test/v1/admin/marketing/jobs", {
      method: "POST",
      headers: submitHeaders,
      body: upload.body,
    });
    const submittedPayload = await submitted.json();
    assert.equal(submitted.status, 201, JSON.stringify(submittedPayload));
    const submittedData = submittedPayload.data;
    assert.equal(submittedData.status, "QUEUED");
    assert.equal(submittedData.replayed, false);

    const retryUpload = multipartBody({ symptom: "ignored retry body" });
    const replay = await edge.fetch("https://fixture.test/v1/admin/marketing/jobs", {
      method: "POST",
      headers: {
        ...submitHeaders,
        "content-type": retryUpload.contentType,
        "content-length": String(retryUpload.body.byteLength),
      },
      body: retryUpload.body,
    });
    assert.equal(replay.status, 200);
    assert.deepEqual((await replay.json()).data, { ...submittedData, replayed: true });
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM marketing_jobs").first()).count, 1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM marketing_job_assets").first()).count, 1);

    const jobs = await edge.fetch("https://fixture.test/v1/admin/marketing/jobs?limit=10", {
      headers: { cookie: ownerCookie },
    });
    assert.equal(jobs.status, 200);
    const jobsPayload = await jobs.json();
    assert.equal(jobsPayload.data.jobs.length, 1);
    assert.equal(jobsPayload.data.jobs[0].id, submittedData.jobId);
    assert.equal(jobsPayload.data.jobs[0].idempotencyKey, undefined);
    assert.equal(jobsPayload.data.jobs[0].requestedBy, undefined);

    const vox = await edge.fetch("https://fixture.test/v1/admin/integrations/vox?limit=10", {
      headers: { cookie: ownerCookie },
    });
    assert.equal(vox.status, 200);
    const voxPayload = await vox.json();
    assert.equal(voxPayload.data.health.configured, true);
    assert.equal(voxPayload.data.summary.total, 0);
    assert.doesNotMatch(JSON.stringify(voxPayload), new RegExp(VOX_SECRET));
  } finally {
    await mf.dispose();
  }
});

test("Vox processing is globally idempotent across ten new calls and legacy-to-new replay", async () => {
  const { mf, db, edge, core } = await createFixture();
  try {
    const callId = "fixture-new-call-10x";
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      signedVoxRequest(edge, "https://fixture.test/v1/vox", callId)));
    assert.ok(responses.every((response) => response.status === 200));
    const statuses = await Promise.all(responses.map((response) => response.json()));
    assert.equal(statuses.filter((body) => body.status === "created").length, 1);
    assert.equal(statuses.filter((body) => body.status === "duplicate").length, 9);
    const intake = await db.prepare("SELECT request_id FROM integration_intakes WHERE external_id = ?").bind(callId).first();
    const source = await db.prepare("SELECT source_site, source_channel FROM service_requests WHERE id = ?").bind(intake.request_id).first();
    assert.deepEqual({ ...source }, { source_site: "new", source_channel: "VOX" });
    for (const table of ["request_status_history", "request_operations", "notification_outbox"]) {
      assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE request_id = ?`).bind(intake.request_id).first()).count, 1);
    }

    const legacyCallId = "fixture-legacy-before-cutover";
    const legacy = await signedVoxRequest(core, "https://combaksa.pe.kr/api/integrations/vox/webhook", legacyCallId);
    assert.equal(legacy.status, 200);
    assert.equal((await legacy.json()).status, "created");
    const before = await db.prepare("SELECT request_id FROM integration_intakes WHERE external_id = ?").bind(legacyCallId).first();
    const replay = await signedVoxRequest(edge, "https://fixture.test/v1/vox", legacyCallId);
    assert.equal((await replay.json()).status, "duplicate");
    const after = await db.prepare("SELECT request_id FROM integration_intakes WHERE external_id = ?").bind(legacyCallId).first();
    assert.equal(after.request_id, before.request_id);
    assert.equal((await db.prepare("SELECT source_site FROM service_requests WHERE id = ?").bind(before.request_id).first()).source_site, "legacy");
  } finally {
    await mf.dispose();
  }
});

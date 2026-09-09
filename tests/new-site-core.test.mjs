import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../drizzle/0015_new_site_core.sql", import.meta.url), "utf8")
  .replaceAll("--> statement-breakpoint", "");

function legacyFixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE service_requests (
      id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE integration_intakes (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, request_id TEXT
    );
    CREATE TABLE customer_lookup_sessions (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE notification_outbox (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, next_attempt_at TEXT NOT NULL
    );
    INSERT INTO service_requests VALUES
      ('plain', 'R-PLAIN', '010-1111-2222', '2026-09-09T00:00:00.000Z'),
      ('vox', 'R-VOX', '010-3333-4444', '2026-09-09T00:01:00.000Z');
    INSERT INTO integration_intakes VALUES ('intake', 'VOX', 'vox');
  `);
  db.exec(migration);
  return db;
}

test("migration preserves unknown provenance unless a Vox intake proves the channel", () => {
  const db = legacyFixture();
  const rows = db.prepare(`
    SELECT id, source_site, source_channel FROM service_requests ORDER BY id
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(rows, [
    { id: "plain", source_site: "legacy", source_channel: "UNKNOWN" },
    { id: "vox", source_site: "legacy", source_channel: "VOX" },
  ]);
  db.close();
});

test("customer sessions are host-scoped and legacy rows default to legacy", () => {
  const db = legacyFixture();
  db.prepare(`INSERT INTO customer_lookup_sessions
    (id, token_hash, expires_at, created_at, site_scope) VALUES (?, ?, ?, ?, ?)`)
    .run("new", "new-token", "2099-01-01T00:00:00.000Z", "2026-09-09T00:00:00.000Z", "new");
  db.prepare(`INSERT INTO customer_lookup_sessions
    (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run("legacy", "legacy-token", "2099-01-01T00:00:00.000Z", "2026-09-09T00:00:00.000Z");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM customer_lookup_sessions WHERE token_hash = ? AND site_scope = 'new'").get("legacy-token").count, 0);
  assert.equal(db.prepare("SELECT site_scope FROM customer_lookup_sessions WHERE token_hash = ?").get("legacy-token").site_scope, "legacy");
  assert.equal(db.prepare("SELECT site_scope FROM customer_lookup_sessions WHERE token_hash = ?").get("new-token").site_scope, "new");
  db.close();
});

function guardedSubmit(db, { key, payloadHash, requestId, phone }) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const inserted = db.prepare(`INSERT OR IGNORE INTO web_submission_idempotency
      (site_scope, idempotency_key, payload_hash, request_id, created_at)
      VALUES ('new', ?, ?, ?, '2026-09-09T00:00:00.000Z')`).run(key, payloadHash, requestId);
    db.prepare(`INSERT INTO service_requests
      (id, public_id, phone, created_at, source_site, source_channel)
      SELECT ?, ?, ?, '2026-09-09T00:00:00.000Z', 'new', 'WEB'
      FROM web_submission_idempotency
      WHERE site_scope = 'new' AND idempotency_key = ?
        AND payload_hash = ? AND request_id = ?`)
      .run(requestId, `R-${requestId}`, phone, key, payloadHash, requestId);
    const row = db.prepare(`SELECT payload_hash, request_id FROM web_submission_idempotency
      WHERE site_scope = 'new' AND idempotency_key = ?`).get(key);
    db.exec("COMMIT");
    return {
      created: inserted.changes === 1,
      conflict: row.payload_hash !== payloadHash,
      requestId: row.request_id,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

test("guarded idempotency replays uncertain responses, conflicts on changed payload, and preserves distinct same-phone requests", () => {
  const db = legacyFixture();
  const first = guardedSubmit(db, { key: "submission-a", payloadHash: "hash-a", requestId: "new-a", phone: "010-9999-0000" });
  const replay = guardedSubmit(db, { key: "submission-a", payloadHash: "hash-a", requestId: "retry-a", phone: "010-9999-0000" });
  const conflict = guardedSubmit(db, { key: "submission-a", payloadHash: "hash-b", requestId: "changed-a", phone: "010-9999-0000" });
  const separate = guardedSubmit(db, { key: "submission-b", payloadHash: "hash-a", requestId: "new-b", phone: "010-9999-0000" });
  assert.deepEqual(first, { created: true, conflict: false, requestId: "new-a" });
  assert.deepEqual(replay, { created: false, conflict: false, requestId: "new-a" });
  assert.deepEqual(conflict, { created: false, conflict: true, requestId: "new-a" });
  assert.equal(separate.created, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM service_requests WHERE phone = ? AND source_site = 'new'").get("010-9999-0000").count, 2);
  db.close();
});

test("blog upsert does not undo an operator-hidden row", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE blog_posts (
    id TEXT PRIMARY KEY, post_url TEXT UNIQUE, title TEXT, excerpt TEXT,
    content_type TEXT, district TEXT, thumbnail_url TEXT, published_at TEXT,
    source_job_id TEXT, source TEXT, visibility TEXT, synced_at TEXT
  )`);
  db.prepare(`INSERT INTO blog_posts VALUES
    ('post', 'https://blog.naver.com/combaksa_repair/123456', 'old', '',
     'repair_diary', '서울', '', '2026-09-08T00:00:00.000Z', '', 'event', 'HIDDEN', '2026-09-08T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO blog_posts
    (id, post_url, title, excerpt, content_type, district, thumbnail_url,
     published_at, source_job_id, source, visibility, synced_at)
    VALUES (?, ?, ?, '', 'recommended', '', '', ?, '', 'rss', 'PUBLISHED', ?)
    ON CONFLICT(post_url) DO UPDATE SET title = excluded.title,
      visibility = blog_posts.visibility, synced_at = excluded.synced_at`)
    .run("replacement", "https://blog.naver.com/combaksa_repair/123456", "rss title", "2026-09-09T00:00:00.000Z", "2026-09-09T00:00:00.000Z");
  assert.equal(db.prepare("SELECT visibility FROM blog_posts WHERE id = 'post'").get().visibility, "HIDDEN");
  db.close();
});

test("vinext bundle preserves NewSiteCore only as a named export", () => {
  const bundle = readFileSync(new URL("../dist/server/index.js", import.meta.url), "utf8");
  assert.match(bundle, /export \{ NewSiteCore, .* as default \}/);
  assert.doesNotMatch(bundle, /pathname\.startsWith\(["']\/v1\//);
});

test("isolated staging config cannot bind the legacy Worker data plane or public routes", () => {
  const config = readFileSync(new URL("../wrangler.new-site-staging.jsonc", import.meta.url), "utf8");
  assert.match(config, /"name": "combaksa-repair-core-staging"/);
  assert.match(config, /"main": "\.\/dist\/server\/index\.js"/);
  assert.match(config, /"workers_dev": false/);
  assert.match(config, /"preview_urls": false/);
  assert.match(config, /"database_name": "combaksa-repair-new-staging-db"/);
  assert.match(config, /"database_id": "5574a741-8151-40fa-8c01-584a59a06862"/);
  assert.match(config, /"bucket_name": "combaksa-repair-new-staging-backups"/);
  assert.match(config, /"bucket_name": "combaksa-repair-new-staging-photos"/);
  assert.match(config, /"queue": "combaksa-repair-new-staging-jobs"/);
  assert.doesNotMatch(config, /"routes?"\s*:/);
  assert.doesNotMatch(config, /"triggers"\s*:/);
  assert.doesNotMatch(config, /combaksa\.pe\.kr|baroon-computer-repair-db|combaksa-computer-repair-backups|combaksa-marketing-repair-photos|combaksa-marketing-jobs/);
});

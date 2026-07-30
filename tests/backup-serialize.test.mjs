import assert from "node:assert/strict";
import test from "node:test";

import {
  orderTablesByDependency,
  parseTableReferences,
  quoteIdentifier,
  serializeBackup,
  toSqlLiteral,
} from "../lib/backup-serialize.ts";

const meta = {
  databaseName: "baroon-computer-repair-db",
  generatedAt: "2026-07-30T18:00:00.000Z",
  backupDate: "2026-07-31",
};

test("escapes values so a restore cannot be broken by customer input", () => {
  // An apostrophe in a name or address is the realistic way a dump becomes
  // unparseable, which would only surface during an emergency restore.
  assert.equal(toSqlLiteral("김'철수"), "'김''철수'");
  assert.equal(toSqlLiteral("O''Neil"), "'O''''Neil'");
  assert.equal(toSqlLiteral("두 줄\n주소"), "'두 줄\n주소'");
  assert.equal(toSqlLiteral(""), "''");

  assert.equal(toSqlLiteral(null), "NULL");
  assert.equal(toSqlLiteral(undefined), "NULL");
  assert.equal(toSqlLiteral(0), "0");
  assert.equal(toSqlLiteral(-12345), "-12345");
  assert.equal(toSqlLiteral(1.5), "1.5");
  assert.equal(toSqlLiteral(9007199254740993n), "9007199254740993");
  assert.equal(toSqlLiteral(true), "1");
  assert.equal(toSqlLiteral(false), "0");

  // SQLite reads these back as NULL regardless, so never emit a bad literal.
  assert.equal(toSqlLiteral(Number.NaN), "NULL");
  assert.equal(toSqlLiteral(Number.POSITIVE_INFINITY), "NULL");

  assert.equal(toSqlLiteral(new Uint8Array([0, 15, 255])), "X'000fff'");
  assert.equal(toSqlLiteral(new Uint8Array([1, 2]).buffer), "X'0102'");

  // Guessing at an unknown type would produce a dump that fails at restore.
  assert.throws(() => toSqlLiteral({ nested: true }), /Cannot serialize/);
});

test("quotes identifiers", () => {
  assert.equal(quoteIdentifier("service_requests"), '"service_requests"');
  assert.equal(quoteIdentifier('od"d'), '"od""d"');
});

test("reads parent tables out of the CREATE TABLE statement", () => {
  // The exact shape drizzle emits in drizzle/*.sql.
  const ddl = `CREATE TABLE \`request_status_history\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`request_id\` text NOT NULL,
    FOREIGN KEY (\`request_id\`) REFERENCES \`service_requests\`(\`id\`) ON UPDATE no action ON DELETE no action
  )`;
  assert.deepEqual(parseTableReferences(ddl), ["service_requests"]);

  assert.deepEqual(
    parseTableReferences('FOREIGN KEY (a) REFERENCES "customer_lookup_sessions"("id")'),
    ["customer_lookup_sessions"],
  );
  assert.deepEqual(parseTableReferences("REFERENCES admins (id)"), ["admins"]);
  assert.deepEqual(parseTableReferences("CREATE TABLE admins (id text)"), []);
});

test("orders tables parent-first so foreign keys hold statement by statement", () => {
  const order = orderTablesByDependency(
    new Map([
      ["request_operations", ["service_requests"]],
      ["service_requests", []],
      ["customer_lookup_session_requests", ["customer_lookup_sessions", "service_requests"]],
      ["customer_lookup_sessions", []],
    ]),
  );

  const at = (name) => order.indexOf(name);
  assert.equal(order.length, 4);
  assert.ok(at("service_requests") < at("request_operations"));
  assert.ok(at("service_requests") < at("customer_lookup_session_requests"));
  assert.ok(at("customer_lookup_sessions") < at("customer_lookup_session_requests"));
});

test("does not stall on self references or dependency cycles", () => {
  assert.deepEqual(orderTablesByDependency(new Map([["tree", ["tree"]]])), ["tree"]);

  // A cycle must still emit every table rather than loop forever.
  const cycle = orderTablesByDependency(
    new Map([
      ["a", ["b"]],
      ["b", ["a"]],
      ["c", []],
    ]),
  );
  assert.deepEqual([...cycle].sort(), ["a", "b", "c"]);
});

test("writes a restorable data-only script", () => {
  const sql = serializeBackup(
    [
      {
        name: "service_requests",
        rows: [
          { id: "r1", name: "김'철수", postal_code: null, total: 0 },
          { id: "r2", name: "이영희", postal_code: "01234", total: 15000 },
        ],
      },
      { name: "access_attempts", rows: [] },
    ],
    meta,
  );

  // Schema is restored from drizzle/*.sql, so the dump must not carry DDL.
  assert.doesNotMatch(sql, /CREATE TABLE/i);
  // Nor may it delete anything — it is applied to an empty database.
  assert.doesNotMatch(sql, /\bDROP\b|\bDELETE\b/i);

  assert.match(sql, /^-- baroon-computer-repair-db data-only backup for 2026-07-31 \(KST\)/);
  assert.match(sql, /-- generated_at: 2026-07-30T18:00:00\.000Z/);
  assert.match(sql, /PRAGMA defer_foreign_keys = true;/);
  // The header must carry the restore procedure; nobody looks it up mid-outage.
  assert.match(sql, /wrangler d1 migrations apply baroon-computer-repair-db --remote/);
  assert.match(sql, /wrangler d1 execute baroon-computer-repair-db --remote --file/);

  assert.match(
    sql,
    /INSERT INTO "service_requests" \("id", "name", "postal_code", "total"\) VALUES/,
  );
  assert.match(sql, /\('r1', '김''철수', NULL, 0\)/);
  assert.match(sql, /\('r2', '이영희', '01234', 15000\)/);

  assert.match(sql, /-- access_attempts: 0 row\(s\)/);
  assert.doesNotMatch(sql, /INSERT INTO "access_attempts"/);

  // Every statement has to be terminated or a batched restore breaks.
  for (const statement of sql.split("\n").filter((line) => line.startsWith("INSERT INTO"))) {
    assert.ok(statement.endsWith("VALUES"), `unterminated INSERT header: ${statement}`);
  }
  assert.equal(sql.match(/;\s*$/m) !== null, true);
});

test("splits large tables into several INSERT statements", () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ id: `r${index}` }));
  const sql = serializeBackup([{ name: "service_requests", rows }], meta);

  const inserts = sql.match(/INSERT INTO "service_requests"/g) ?? [];
  assert.equal(inserts.length, 2, "201 rows should chunk into 2 statements at 200 rows each");
  assert.match(sql, /-- service_requests: 201 row\(s\)/);
  // The last tuple of a chunk ends the statement, mid-chunk tuples do not.
  assert.equal((sql.match(/\);/g) ?? []).length, 2);
});

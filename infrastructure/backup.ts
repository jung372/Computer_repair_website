import { env } from "cloudflare:workers";
import {
  orderTablesByDependency,
  parseTableReferences,
  quoteIdentifier,
  serializeBackup,
  type TableDump,
} from "@/lib/backup-serialize";

/**
 * Copies the D1 contents into R2 once a day. R2 lives in the same Cloudflare
 * account as D1, so this guards against mistakes and deletions — not against
 * losing the account. An offsite copy still needs `tools/backup-local.bat`.
 */

/** Wrangler and SQLite own these; the migrations rebuild them on restore. */
const RESERVED_TABLE_PREFIXES = ["sqlite_", "_cf_", "d1_"];

const BACKUP_PREFIX = "backups";
const MANIFEST_KEY = `${BACKUP_PREFIX}/latest.json`;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type BackupResult = {
  key: string;
  bytes: number;
  sha256: string;
  totalRows: number;
  tables: { name: string; rows: number }[];
  generatedAt: string;
};

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireBucket(): R2Bucket {
  if (!env.BACKUPS) {
    throw new Error(
      "R2 binding `BACKUPS` is unavailable. Enable R2, create the bucket, then configure the binding in wrangler.jsonc.",
    );
  }
  return env.BACKUPS;
}

function requireDatabase(): D1Database {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable. Configure the binding in wrangler.jsonc.");
  }
  return env.DB;
}

/** The KST calendar day the backup belongs to — the cron fires at 03:00 KST. */
function toBackupDate(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Reads the table names and their parent tables straight from `sqlite_master`,
 * so a migration that adds a table cannot quietly drop out of the backup.
 */
async function readTableGraph(db: D1Database): Promise<Map<string, string[]>> {
  const { results } = await db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL")
    .all<{ name: string; sql: string }>();

  const tables = results.filter(
    (row) => !RESERVED_TABLE_PREFIXES.some((prefix) => row.name.startsWith(prefix)),
  );
  const names = new Set(tables.map((row) => row.name));

  return new Map(
    tables.map((row) => [
      row.name,
      // Keep only parents that are themselves backed up.
      parseTableReferences(row.sql).filter((parent) => names.has(parent)),
    ]),
  );
}

export async function runDailyBackup(now = new Date()): Promise<BackupResult> {
  const db = requireDatabase();
  const bucket = requireBucket();

  const graph = await readTableGraph(db);
  if (graph.size === 0) {
    throw new Error("Found no application tables to back up.");
  }
  const ordered = orderTablesByDependency(graph);

  // One batch is one transaction, so every table is read at the same point in
  // time instead of drifting while an incoming 접수 writes.
  const reads = await db.batch<Record<string, unknown>>(
    ordered.map((table) => db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`)),
  );
  const dumps: TableDump[] = ordered.map((table, index) => ({
    name: table,
    rows: reads[index]?.results ?? [],
  }));

  const generatedAt = now.toISOString();
  const backupDate = toBackupDate(now);
  const sql = serializeBackup(dumps, {
    databaseName: "baroon-computer-repair-db",
    generatedAt,
    backupDate,
  });

  const key = `${BACKUP_PREFIX}/${backupDate}.sql`;
  const encoded = new TextEncoder().encode(sql);
  const bytes = encoded.byteLength;
  const sha256 = toHex(await crypto.subtle.digest("SHA-256", encoded));
  const tables = dumps.map((dump) => ({ name: dump.name, rows: dump.rows.length }));
  const result: BackupResult = {
    key,
    bytes,
    sha256,
    totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
    tables,
    generatedAt,
  };

  await bucket.put(key, encoded, {
    httpMetadata: { contentType: "application/sql; charset=utf-8" },
    customMetadata: { sha256 },
  });

  const manifest = JSON.stringify(result, null, 2);
  const manifestOptions = {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  };
  // Keep an immutable sidecar beside each dump for offsite verification, and a
  // stable pointer so the server PC can fetch the newest backup with two GETs.
  await bucket.put(`${BACKUP_PREFIX}/${backupDate}.json`, manifest, manifestOptions);
  await bucket.put(MANIFEST_KEY, manifest, manifestOptions);

  return result;
}

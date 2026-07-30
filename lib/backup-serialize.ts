/**
 * Turns D1 rows into a data-only SQL script that `wrangler d1 execute --file`
 * can replay. Pure text handling only — no I/O — so the escaping rules that
 * decide whether a restore succeeds can be tested directly.
 *
 * The schema is deliberately not part of the dump: it already lives in
 * `drizzle/*.sql`, so a restore applies the migrations first and then this file.
 */

/** Rows are grouped so a restore sends far fewer statements than it has rows. */
const ROWS_PER_INSERT = 200;

export type TableDump = {
  name: string;
  rows: Record<string, unknown>[];
};

export type BackupMeta = {
  databaseName: string;
  /** ISO instant the backup ran, for the file header. */
  generatedAt: string;
  /** KST calendar day the backup belongs to, matching the object key. */
  backupDate: string;
};

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    // SQLite cannot hold NaN or Infinity — it reads them back as NULL anyway,
    // so write NULL rather than an unparseable literal.
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (value instanceof ArrayBuffer) return toBlobLiteral(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return toBlobLiteral(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  }
  // Guessing here would produce a dump that only fails at restore time.
  throw new Error(`Cannot serialize a column value of type ${typeof value}`);
}

function toBlobLiteral(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `X'${hex}'`;
}

/**
 * Reads the parent tables out of a `CREATE TABLE` statement. Taken from the DDL
 * in `sqlite_master` rather than `PRAGMA foreign_key_list` so the backup relies
 * only on the plain query D1 is already known to answer.
 */
export function parseTableReferences(createTableSql: string): string[] {
  const pattern = /references\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/gi;
  const parents = new Set<string>();
  for (const match of createTableSql.matchAll(pattern)) {
    const parent = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (parent) parents.add(parent);
  }
  return [...parents];
}

/**
 * Orders tables parent-first so the INSERTs satisfy foreign keys even when the
 * restore is applied one statement at a time instead of as one transaction.
 */
export function orderTablesByDependency(dependencies: Map<string, string[]>): string[] {
  const pending = new Set(dependencies.keys());
  const ordered: string[] = [];

  while (pending.size > 0) {
    const ready = [...pending]
      .filter((table) =>
        (dependencies.get(table) ?? []).every(
          // A self reference never blocks its own table.
          (parent) => parent === table || !pending.has(parent),
        ),
      )
      .sort();

    if (ready.length === 0) {
      // A reference cycle would spin forever. Emit the remainder alphabetically
      // and let PRAGMA defer_foreign_keys carry the restore.
      ordered.push(...[...pending].sort());
      break;
    }

    for (const table of ready) pending.delete(table);
    ordered.push(...ready);
  }

  return ordered;
}

export function serializeBackup(dumps: TableDump[], meta: BackupMeta): string {
  const lines = [
    `-- ${meta.databaseName} data-only backup for ${meta.backupDate} (KST)`,
    `-- generated_at: ${meta.generatedAt}`,
    "--",
    "-- Restore into an empty database, schema first:",
    `--   wrangler d1 migrations apply ${meta.databaseName} --remote`,
    `--   wrangler d1 execute ${meta.databaseName} --remote --file <this file>`,
    "--",
    "-- Tables are ordered parent-first, so this file also restores correctly",
    "-- when it is split across several batches.",
    "PRAGMA defer_foreign_keys = true;",
  ];

  for (const dump of dumps) {
    const table = quoteIdentifier(dump.name);
    lines.push("", `-- ${dump.name}: ${dump.rows.length} row(s)`);

    if (dump.rows.length === 0) {
      lines.push(`-- (empty, nothing to insert)`);
      continue;
    }

    // Every D1 row carries the full column set, so the first row defines the
    // column list for the whole table.
    const columns = Object.keys(dump.rows[0]);
    const columnList = columns.map(quoteIdentifier).join(", ");

    for (let start = 0; start < dump.rows.length; start += ROWS_PER_INSERT) {
      const chunk = dump.rows.slice(start, start + ROWS_PER_INSERT);
      const tuples = chunk.map(
        (row) => `  (${columns.map((column) => toSqlLiteral(row[column])).join(", ")})`,
      );
      lines.push(`INSERT INTO ${table} (${columnList}) VALUES`, `${tuples.join(",\n")};`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

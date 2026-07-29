import { ensureDatabase, getD1 } from "@/data/database";
import { sha256 } from "@/lib/security/keyed-hash";

export const CUSTOMER_LOOKUP_COOKIE = "combaksa_request_lookup";
const SESSION_LIFETIME_MS = 10 * 60 * 1000;

export type LookupCandidate = {
  id: string;
  public_id: string;
  access_password_hash: string | null;
};

export async function findKeyedLookupCandidates(
  phone: string,
  lookupKey: string,
  limit = 20,
) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT id, public_id, access_password_hash
      FROM service_requests
      WHERE lookup_key = ? AND REPLACE(phone, '-', '') = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(lookupKey, phone, limit)
    .all<LookupCandidate>();
  return result.results;
}

export async function findLegacyLookupCandidates(phone: string, limit = 21) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(`
      SELECT id, public_id, access_password_hash
      FROM service_requests
      WHERE lookup_key IS NULL AND REPLACE(phone, '-', '') = ? AND access_password_hash IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(phone, limit)
    .all<LookupCandidate>();
  return result.results;
}

export async function createCustomerLookupSession(requestIds: string[]) {
  await ensureDatabase();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString();
  const db = getD1();
  await db.batch([
    db
      .prepare(`
        INSERT INTO customer_lookup_sessions (id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .bind(id, tokenHash, expiresAt, createdAt),
    ...requestIds.map((requestId) =>
      db
        .prepare(`
          INSERT INTO customer_lookup_session_requests (session_id, request_id, created_at)
          VALUES (?, ?, ?)
        `)
        .bind(id, requestId, createdAt),
    ),
  ]);
  return { token, expiresAt };
}

export async function getCustomerLookupRequestIds(token?: string) {
  if (!token) return [];
  await ensureDatabase();
  const tokenHash = await sha256(token);
  const session = await getD1()
    .prepare("SELECT id, expires_at FROM customer_lookup_sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ id: string; expires_at: string }>();
  if (!session) return [];
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await deleteCustomerLookupSession(token);
    return [];
  }
  const result = await getD1()
    .prepare(`
      SELECT request_id
      FROM customer_lookup_session_requests
      WHERE session_id = ?
      ORDER BY created_at DESC
    `)
    .bind(session.id)
    .all<{ request_id: string }>();
  return result.results.map((row) => row.request_id);
}

export async function customerLookupSessionCanAccess(token: string | undefined, requestId: string) {
  if (!token) return false;
  await ensureDatabase();
  const tokenHash = await sha256(token);
  const row = await getD1()
    .prepare(`
      SELECT 1 AS allowed
      FROM customer_lookup_sessions AS sessions
      INNER JOIN customer_lookup_session_requests AS links
        ON links.session_id = sessions.id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND links.request_id = ?
      LIMIT 1
    `)
    .bind(tokenHash, new Date().toISOString(), requestId)
    .first<{ allowed: number }>();
  return Boolean(row);
}

export async function deleteCustomerLookupSession(token?: string) {
  if (!token) return;
  await ensureDatabase();
  const tokenHash = await sha256(token);
  const session = await getD1()
    .prepare("SELECT id FROM customer_lookup_sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ id: string }>();
  if (!session) return;
  const db = getD1();
  await db.batch([
    db
      .prepare("DELETE FROM customer_lookup_session_requests WHERE session_id = ?")
      .bind(session.id),
    db.prepare("DELETE FROM customer_lookup_sessions WHERE id = ?").bind(session.id),
  ]);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

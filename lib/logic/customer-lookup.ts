import {
  createCustomerLookupSession,
  findKeyedLookupCandidates,
  findLegacyLookupCandidates,
  getCustomerLookupRequestIds,
} from "@/data/customer-lookup-repository";
import {
  clearAccessFailures,
  getAccessAttempt,
  listRequestsByIds,
  recordAccessFailure,
} from "@/data/request-repository";
import { assertLookupSecretReady } from "@/data/security-settings-repository";
import { createLookupKey, normalizePhone } from "@/lib/security/lookup-key";
import { hashPassword, verifyPassword } from "@/lib/security/password";

const MAX_CANDIDATES = 20;
let dummyHash: Promise<string> | undefined;

export class CustomerLookupError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "INVALID_CREDENTIALS"
      | "BLOCKED"
      | "LEGACY_LIMIT",
  ) {
    super(code);
  }
}

export async function authenticateCustomerLookup(
  input: { phone?: unknown; password?: unknown },
  clientHash: string,
  phoneHash: string,
) {
  const phone = normalizePhone(typeof input.phone === "string" ? input.phone : "");
  const password = typeof input.password === "string" ? input.password : "";
  const passwordLength = Array.from(password).length;
  if (phone.length < 10 || phone.length > 11 || passwordLength < 4 || passwordLength > 64) {
    throw new CustomerLookupError("INVALID_INPUT");
  }

  await assertLookupSecretReady();
  const attemptKey = `request-lookup:${clientHash}:${phoneHash}`;
  const attempt = await getAccessAttempt(attemptKey);
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    throw new CustomerLookupError("BLOCKED");
  }

  const lookupKey = await createLookupKey(phone, password);
  const keyed = await findKeyedLookupCandidates(phone, lookupKey, MAX_CANDIDATES);
  const remaining = Math.max(0, MAX_CANDIDATES - keyed.length);
  const legacy = remaining
    ? await findLegacyLookupCandidates(phone, remaining + 1)
    : [];
  if (legacy.length > remaining) {
    throw new CustomerLookupError("LEGACY_LIMIT");
  }

  const candidates = [...keyed, ...legacy].filter(
    (candidate): candidate is typeof candidate & { access_password_hash: string } =>
      Boolean(candidate.access_password_hash),
  );
  const checks = candidates.length
    ? await Promise.all(
        candidates.map(async (candidate) => ({
          id: candidate.id,
          valid: await verifyPassword(password, candidate.access_password_hash),
        })),
      )
    : (await verifyDummyPassword(password), []);
  const requestIds = checks.filter((check) => check.valid).map((check) => check.id);

  if (!requestIds.length) {
    await recordAccessFailure(attemptKey);
    throw new CustomerLookupError("INVALID_CREDENTIALS");
  }

  await clearAccessFailures(attemptKey);
  return createCustomerLookupSession(requestIds);
}

export async function getCustomerLookupRequests(token?: string) {
  const ids = await getCustomerLookupRequestIds(token);
  return listRequestsByIds(ids);
}

async function verifyDummyPassword(password: string) {
  dummyHash ??= hashPassword("combaksa-dummy-lookup-password");
  await verifyPassword(password, await dummyHash);
}

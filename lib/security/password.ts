const FORMAT_ALGORITHM = "pbkdf2-sha256";
const FORMAT_VERSION = "v=1";
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_MAX_ITERATIONS = 400_000;
const HASH_ALGORITHM = "SHA-256";
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: HASH_ALGORITHM },
    key,
    keyLength * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH);
  return [
    FORMAT_ALGORITHM,
    FORMAT_VERSION,
    `i=${PBKDF2_ITERATIONS}`,
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, version, parameters, saltValue, hashValue] = encoded.split("$");
  if (
    algorithm !== FORMAT_ALGORITHM ||
    version !== FORMAT_VERSION ||
    !parameters?.startsWith("i=") ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  const iterations = Number(parameters.slice(2));
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_MAX_ITERATIONS) {
    return false;
  }

  try {
    const expected = base64ToBytes(hashValue);
    if (!expected.length || expected.length > KEY_LENGTH) return false;
    const actual = await deriveBits(
      password,
      base64ToBytes(saltValue),
      iterations,
      expected.length,
    );
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

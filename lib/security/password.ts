import { argon2idAsync } from "@noble/hashes/argon2.js";

const ARGON_OPTIONS = {
  m: 19 * 1024,
  t: 2,
  p: 1,
  dkLen: 32,
};

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

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await argon2idAsync(password, salt, ARGON_OPTIONS);
  return [
    "argon2id",
    "v=19",
    `m=${ARGON_OPTIONS.m},t=${ARGON_OPTIONS.t},p=${ARGON_OPTIONS.p}`,
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, version, parameters, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "argon2id" || version !== "v=19" || !parameters || !saltValue || !hashValue) {
    return false;
  }

  const parsed = Object.fromEntries(
    parameters.split(",").map((part) => part.split("=")),
  );
  const options = {
    m: Number(parsed.m),
    t: Number(parsed.t),
    p: Number(parsed.p),
    dkLen: base64ToBytes(hashValue).length,
  };
  if (!options.m || !options.t || !options.p || !options.dkLen) return false;

  const actual = await argon2idAsync(password, base64ToBytes(saltValue), options);
  return constantTimeEqual(actual, base64ToBytes(hashValue));
}

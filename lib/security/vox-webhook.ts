const encoder = new TextEncoder();
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export type VoxSignatureResult =
  | { ok: true; timestampSeconds: number }
  | { ok: false; reason: "MISSING_HEADERS" | "INVALID_TIMESTAMP" | "EXPIRED" | "INVALID_SIGNATURE" };

export async function verifyVoxWebhookSignature(input: {
  rawBody: string;
  secret: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  nowMs?: number;
}): Promise<VoxSignatureResult> {
  if (!input.timestampHeader || !input.signatureHeader) {
    return { ok: false, reason: "MISSING_HEADERS" };
  }
  if (!/^\d{10}$/.test(input.timestampHeader)) {
    return { ok: false, reason: "INVALID_TIMESTAMP" };
  }
  const timestampSeconds = Number(input.timestampHeader);
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "EXPIRED" };
  }
  const signatureMatch = /^sha256=([a-fA-F0-9]{64})$/.exec(input.signatureHeader);
  if (!signatureMatch) return { ok: false, reason: "INVALID_SIGNATURE" };

  const expected = await hmacSha256(
    input.secret,
    `${input.timestampHeader}.${input.rawBody}`,
  );
  return constantTimeEqual(expected, signatureMatch[1].toLowerCase())
    ? { ok: true, timestampSeconds }
    : { ok: false, reason: "INVALID_SIGNATURE" };
}

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(secret: string, value: Uint8Array | string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = typeof value === "string" ? encoder.encode(value) : value;
  const signature = await crypto.subtle.sign("HMAC", key, Uint8Array.from(data).buffer);
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function lengthDelimited(parts: Array<[string, string]>) {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (const [label, value] of parts) {
    const labelBytes = encoder.encode(label);
    const valueBytes = encoder.encode(value);
    const header = new Uint8Array(8);
    const view = new DataView(header.buffer);
    view.setUint32(0, labelBytes.length);
    view.setUint32(4, valueBytes.length);
    chunks.push(header, labelBytes, valueBytes);
    length += header.length + labelBytes.length + valueBytes.length;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

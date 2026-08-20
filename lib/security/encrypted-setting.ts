import { getRuntimeString } from "@/lib/runtime-config";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getEncryptionKey() {
  const secret = getRuntimeString("STAFF_CHAT_ID_ENCRYPTION_KEY");
  if (secret.length < 32) throw new Error("STAFF_CHAT_ID_ENCRYPTION_KEY_NOT_CONFIGURED");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptStaffChatId(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getEncryptionKey(),
    encoder.encode(value),
  );
  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  };
}

export async function decryptStaffChatId(ciphertext: string, iv: string) {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(iv) },
      await getEncryptionKey(),
      fromBase64Url(ciphertext),
    );
    return decoder.decode(plaintext);
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_CHAT_ID_ENCRYPTION_KEY_NOT_CONFIGURED") {
      throw error;
    }
    throw new Error("STAFF_CHAT_ID_DECRYPTION_FAILED");
  }
}

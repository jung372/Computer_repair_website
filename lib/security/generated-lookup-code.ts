const LOOKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOOKUP_CODE_CHARACTERS = 12;

export function generateLookupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LOOKUP_CODE_CHARACTERS));
  const characters = Array.from(
    bytes,
    (byte) => LOOKUP_CODE_ALPHABET[byte & 31],
  );
  return [
    characters.slice(0, 4).join(""),
    characters.slice(4, 8).join(""),
    characters.slice(8, 12).join(""),
  ].join("-");
}

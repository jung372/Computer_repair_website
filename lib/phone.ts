// Single source of truth for phone number handling.
//
// Whatever the applicant types — hyphens, spaces, dots, parentheses, a +82
// country code, or full-width digits from an IME — never reaches storage or a
// comparison directly. Every path funnels through normalizePhone first, so the
// stored format is decided by formatPhone alone, never by raw input.

const FULLWIDTH_OFFSET = 0xfee0;

/** Strips everything down to the domestic digit sequence. */
export function normalizePhone(value: string) {
  return String(value ?? "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/^\s*(?:\+|00)\s*82[\s.\-()]*0?/, "0")
    .replace(/\D/g, "");
}

/**
 * Canonical stored form: 010-1234-5678 / 011-123-4567 / 02-1234-5678.
 * Returns the bare digits when the length is outside the accepted range so the
 * caller's own length validation stays the single place that rejects input.
 */
export function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return digits.startsWith("02")
      ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

/**
 * Progressive form used while typing, where the final length is not yet known.
 * Groups as 3-4-4 (2-4-4 for 02) and never emits a trailing hyphen, so the
 * caret stays put and backspace behaves normally.
 */
export function formatPhoneInput(value: string) {
  const digits = normalizePhone(value).slice(0, 11);
  const [head, rest] = digits.startsWith("02")
    ? [digits.slice(0, 2), digits.slice(2)]
    : [digits.slice(0, 3), digits.slice(3)];
  if (!rest) return head;
  const middle = rest.slice(0, 4);
  const tail = rest.slice(4);
  return tail ? `${head}-${middle}-${tail}` : `${head}-${middle}`;
}

/**
 * What an input should show once it loses focus: the canonical form when the
 * number is complete, the progressive form while it is not. Without the second
 * branch an unfinished number would collapse back to bare digits.
 */
export function formatPhoneOnBlur(value: string) {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11
    ? formatPhone(digits)
    : formatPhoneInput(digits);
}

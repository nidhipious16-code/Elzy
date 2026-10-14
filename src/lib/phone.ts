// Normalises a mobile number to E.164 (+919876543210). Returns null when it
// does not look like a phone number.
export function normalizePhone(input: string | null | undefined, countryCode = process.env.DEFAULT_COUNTRY_CODE ?? "91") {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+${countryCode}${digits.slice(1)}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

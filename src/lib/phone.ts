// Shared Indian-mobile validation (used by the Cashfree create-order API
// route and mirrored inline in the register page).
// Validate a stored mobile as an Indian mobile number: strip non-digits,
// drop a leading country code (91) or trunk 0, then require exactly 10
// digits starting 6–9. Returns the 10-digit number, or null when the
// stored value is missing / too short / not a valid Indian mobile.
// NOTE: Cashfree requires a customer phone, so when this returns null the
// caller falls back to "9999999999" as a LAST RESORT only — the student
// then cannot be reached about the payment. The real fix is collecting a
// valid mobile at registration (src/app/auth/register/page.tsx validates
// it); the fallback exists only so a legacy profile without a usable
// mobile can still pay.
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return ten.length === 10 && /^[6-9]/.test(ten) ? ten : null;
}

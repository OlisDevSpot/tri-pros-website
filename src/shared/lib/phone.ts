import { z } from 'zod'

// ─── phone — ONE canonical home for every phone-number transform ───────────
//
// see docs/codebase-conventions/phone-numbers.md
//
// The business is Southern-California-only, so every real number is a US
// 10-digit local number. We standardize on two shapes and never mix them:
//
//   • STORAGE (canonical)  — bare 10 national digits, e.g. "8186511445".
//     This is what lives in `customers.phone`. Enforced at the DB write
//     boundary by `optionalPhoneSchema` on the customer insert/update schema
//     (createCrudDal parses every write), so no caller can persist anything else.
//
//   • E.164 (external)     — "+18186511445". Produced ONLY at external-API
//     boundaries that require it (Twilio, CloudTalk) via `toE164`.
//
// Display always goes through `formatPhone` → "(818) 651-1445".
//
// `toNationalDigits` is the shared primitive; everything else is built on it
// and is deliberately defensive (accepts 10-digit, 11-digit 1-prefixed, E.164,
// or already-formatted input) so renders stay correct while legacy rows are
// migrated to the canonical shape.

/** Strip a string to digits only. Use for fuzzy phone SEARCH against the canonical store. */
export function toDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Reduce any phone string to its US national 10 digits, or `null` when the
 * input can't plausibly be one. Strips formatting and a leading US country
 * code. This is the single source of truth all other helpers delegate to.
 */
export function toNationalDigits(input: string | null | undefined): string | null {
  if (!input) {
    return null
  }
  const digits = toDigits(input)
  // Drop a leading US country code ("1") on an 11-digit number.
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return national.length === 10 ? national : null
}

/**
 * E.164 for external APIs that require it (Twilio, CloudTalk). Returns `null`
 * when the input isn't a valid US number — callers should treat that as
 * "not dialable" rather than sending a malformed value.
 */
export function toE164(input: string | null | undefined): string | null {
  const national = toNationalDigits(input)
  return national ? `+1${national}` : null
}

/**
 * Display format `(xxx) xxx-xxxx`. Falls back to the raw input (trimmed) when
 * it can't normalize, so a non-empty value is never blanked out, and returns
 * `''` for empty/null so callers can render unconditionally.
 */
export function formatPhone(input: string | null | undefined): string {
  if (!input) {
    return ''
  }
  const national = toNationalDigits(input)
  if (!national) {
    return input.trim()
  }
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
}

/**
 * Value to place after `tel:` / `sms:` in an href. Uses E.164 (most reliable
 * across native dialers), falling back to the raw input when not a valid US
 * number — e.g. `href={`tel:${toDialString(phone)}`}`.
 */
export function toDialString(input: string | null | undefined): string {
  return toE164(input) ?? input?.trim() ?? ''
}

/**
 * Cheap, FREE plausibility gate — runs BEFORE any paid line-type lookup so
 * obvious junk never costs money. Rejects non-US-10-digit input, all-same-digit,
 * trivial sequential runs, NANP-illegal area/exchange (must start 2-9), and the
 * reserved fictional 555-01xx range. `true` means "worth a paid lookup", NOT
 * "guaranteed real".
 */
export function isPlausibleUsPhone(input: string | null | undefined): boolean {
  const n = toNationalDigits(input)
  if (!n) {
    return false
  }
  if (/^(\d)\1{9}$/.test(n)) {
    return false
  }
  if (n === '1234567890' || n === '0123456789' || n === '9876543210') {
    return false
  }
  const area = n.slice(0, 3)
  const exchange = n.slice(3, 6)
  const subscriber = n.slice(6)
  if (area[0] === '0' || area[0] === '1' || exchange[0] === '0' || exchange[0] === '1') {
    return false
  }
  if (exchange === '555' && subscriber.startsWith('01')) {
    return false
  }
  return true
}

// ─── Zod ───────────────────────────────────────────────────────────────────

/**
 * STORAGE chokepoint. Normalizes any provided value → canonical 10-digit
 * national (or `null`). Applied to the customer insert/update schema so every
 * write path through createCrudDal persists the canonical shape, regardless of
 * what the caller sent (funnel E.164, agent-typed "(818)…", webhook raw).
 *
 * Absent-key contract: an absent key (`undefined`) passes through as `undefined`
 * so partial updates never fabricate a `phone` write — `'phone' in parsed` stays
 * false and buildUpdateSet omits it, preserving the existing value. Any *provided*
 * value is normalized; an explicit `null`/`''` still clears the column.
 */
export const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform(v => (v === undefined ? undefined : toNationalDigits(v)))

/**
 * FORM-input validation (required field). Validation only — no transform — so
 * react-hook-form field types stay `string`; the canonical normalization still
 * happens once, at the DB boundary. Use in user-facing required-phone forms.
 */
export const requiredPhoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .refine(v => toNationalDigits(v) !== null, 'Enter a valid US phone number')

/** Optional form-input variant: empty is allowed, but a non-empty value must be valid. */
export const optionalPhoneInputSchema = z
  .string()
  .refine(v => v === '' || toNationalDigits(v) !== null, 'Enter a valid US phone number')

import { z } from 'zod'

// Storage is bare 10 national digits (`customers.phone`); E.164 only at external-API boundaries (Twilio, JustCall).
// Helpers accept 10-digit, 1-prefixed, E.164, or formatted input so legacy rows still render while they migrate.

export function toDigits(input: string): string {
  return input.replace(/\D/g, '')
}

// The leading 1 of an 11-digit run is the country code, never part of the stored number.
function dropCountryCode(digits: string): string {
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function toNationalDigits(input: string | null | undefined): string | null {
  if (!input) {
    return null
  }
  const national = dropCountryCode(toDigits(input))
  return national.length === 10 ? national : null
}

/** Null unless the term reads as a number (digits plus phone punctuation), so a name search never scans phones; a partial run is kept so "584" can find a stored 8185845629. */
export function toPhoneSearchDigits(input: string): string | null {
  const term = input.trim()
  if (!/^[\d\s().+-]+$/.test(term)) {
    return null
  }
  const digits = dropCountryCode(toDigits(term))
  return digits.length > 0 ? digits : null
}

export function toE164(input: string | null | undefined): string | null {
  const national = toNationalDigits(input)
  return national ? `+1${national}` : null
}

/** Falls back to the trimmed raw input so a non-empty value is never blanked. */
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

/** Reformats from raw digits every keystroke so backspace, paste, and mid-string edits stay correct. */
export function formatPhoneAsYouType(input: string): string {
  const d = toDigits(input).slice(0, 10)
  if (d.length === 0) {
    return ''
  }
  if (d.length <= 3) {
    return `(${d}`
  }
  if (d.length <= 6) {
    return `(${d.slice(0, 3)}) ${d.slice(3)}`
  }
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** E.164 is the most reliable form across native dialers; falls back to the raw input. */
export function toDialString(input: string | null | undefined): string {
  return toE164(input) ?? input?.trim() ?? ''
}

/** Free gate run BEFORE the paid line-type lookup; `true` means "worth a paid lookup", not "guaranteed real". */
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

/** Storage chokepoint. `undefined` passes through untouched so a partial update never fabricates a phone write; an explicit null/'' still clears the column. */
export const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform(v => (v === undefined ? undefined : toNationalDigits(v)))

/** Validation only — no transform — so react-hook-form field types stay `string`; normalization happens once at the DB boundary. */
export const requiredPhoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .refine(v => toNationalDigits(v) !== null, 'Enter a valid US phone number')

export const optionalPhoneInputSchema = z
  .string()
  .refine(v => v === '' || toNationalDigits(v) !== null, 'Enter a valid US phone number')

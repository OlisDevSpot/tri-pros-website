import { toPhoneSearchDigits } from '@/shared/lib/phone'

export type CustomerSearchToken
  = | { kind: 'text', value: string }
    | { kind: 'number', value: string }
    | { kind: 'email', value: string }

export interface CustomerSearchQuery {
  tokens: CustomerSearchToken[]
  /** The whole term read as a phone number, when it is one. Takes over from the tokens. */
  phoneDigits: string | null
}

// Fewer digits than this is more likely a house number or zip than a phone fragment.
const PHONE_MIN_DIGITS = 7
const MAX_TOKENS = 6
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
// Commas and slashes separate words in a name or address, so "Smith,John" reads as two terms.
const TOKEN_SEPARATOR = /[\s,;/]+/
// Phone punctuation around a digit run ("714-555", "(714)") is formatting, not content.
const PHONE_FORMATTED_DIGITS = /^[\d().+-]+$/

export function parseCustomerSearch(term: string): CustomerSearchQuery {
  const normalized = term.trim().replace(/\s+/g, ' ').toLowerCase()
  const digits = toPhoneSearchDigits(normalized)
  if (digits && digits.length >= PHONE_MIN_DIGITS) {
    return { tokens: [], phoneDigits: digits }
  }
  const tokens = normalized
    .split(TOKEN_SEPARATOR)
    .map(classifyToken)
    .filter((token): token is CustomerSearchToken => token !== null)
    .slice(0, MAX_TOKENS)
  return { tokens, phoneDigits: null }
}

function classifyToken(raw: string): CustomerSearchToken | null {
  if (raw.includes('@')) {
    return { kind: 'email', value: raw }
  }
  const value = raw.replace(EDGE_PUNCTUATION, '')
  if (!value) {
    return null
  }
  if (PHONE_FORMATTED_DIGITS.test(value) && /\d/.test(value)) {
    return { kind: 'number', value: value.replace(/\D/g, '') }
  }
  return { kind: 'text', value }
}

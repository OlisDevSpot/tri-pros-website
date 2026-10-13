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

export function parseCustomerSearch(term: string): CustomerSearchQuery {
  const normalized = term.trim().replace(/\s+/g, ' ').toLowerCase()
  const digits = toPhoneSearchDigits(normalized)
  if (digits && digits.length >= PHONE_MIN_DIGITS) {
    return { tokens: [], phoneDigits: digits }
  }
  const tokens = normalized
    .split(' ')
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
  return /^\d+$/.test(value) ? { kind: 'number', value } : { kind: 'text', value }
}

import { toPhoneSearchDigits } from '@/shared/lib/phone'

export type MatchMode = 'text' | 'digits'

export interface MatchSegment {
  text: string
  /** Offset in the source text; unique per segment, so it doubles as a React key. */
  start: number
  hit: boolean
}

const MIN_DIGITS = 3
const WORD_CHARACTER = /[\p{L}\p{N}]/u

// Matches only at a word start, the way the customer matcher accepts address words, so "smi" never lights up "Bosmith".
function wordStartIndex(haystack: string, needle: string): number {
  for (let from = 0; ;) {
    const at = haystack.indexOf(needle, from)
    if (at <= 0 || !WORD_CHARACTER.test(haystack[at - 1])) {
      return at
    }
    from = at + 1
  }
}

function textRanges(text: string, term: string): [number, number][] {
  const haystack = text.toLowerCase()
  return term.toLowerCase().split(/\s+/).filter(Boolean).flatMap((token): [number, number][] => {
    const at = wordStartIndex(haystack, token)
    return at === -1 ? [] : [[at, at + token.length]]
  })
}

// Phone numbers match on digits alone, read the way the server reads the term (a leading country code dropped),
// so "5551" lights up "555-1" across the separator and "+1 714…" lights up "(714)…".
function digitRanges(text: string, term: string): [number, number][] {
  const needle = toPhoneSearchDigits(term) ?? ''
  if (needle.length < MIN_DIGITS) {
    return []
  }
  const positions: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) {
      positions.push(i)
    }
  }
  const at = positions.map(i => text[i]).join('').indexOf(needle)
  return at === -1 ? [] : [[positions[at], positions[at + needle.length - 1] + 1]]
}

export function splitMatch(text: string, term: string, mode: MatchMode = 'text'): MatchSegment[] {
  const ranges = (mode === 'digits' ? digitRanges(text, term) : textRanges(text, term)).sort((a, b) => a[0] - b[0])
  const segments: MatchSegment[] = []
  let cursor = 0
  for (const [rangeStart, end] of ranges) {
    const start = Math.max(rangeStart, cursor)
    if (end <= start) {
      continue
    }
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), start: cursor, hit: false })
    }
    segments.push({ text: text.slice(start, end), start, hit: true })
    cursor = end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), start: cursor, hit: false })
  }
  return segments
}

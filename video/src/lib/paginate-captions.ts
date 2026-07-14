export interface CaptionToken {
  text: string
  fromMs: number
  toMs: number
  emphasis?: boolean
}

export interface CaptionPage {
  /** Display window. Gapless by construction: page N ends exactly when N+1 starts. */
  startMs: number
  endMs: number
  tokens: CaptionToken[]
}

export interface WordInput {
  text: string
  startMs: number
  endMs: number
  emphasis?: boolean
}

const MAX_WORDS = 3
/** Joined length ceiling — at fontSize 56 this can never overflow 1080px. */
const MAX_CHARS = 16
const LAST_PAGE_LINGER_MS = 300
/** End the page after sentence punctuation so boundaries never straddle pages. */
const SENTENCE_END = /[.!?…]$/

export function paginateCaptions(words: WordInput[]): CaptionPage[] {
  const tokens: CaptionToken[] = words
    .map(word => ({ text: word.text.trim(), fromMs: word.startMs, toMs: word.endMs, emphasis: word.emphasis ?? false }))
    .filter(token => token.text.length > 0)
  if (tokens.length === 0)
    return []

  const groups: CaptionToken[][] = []
  let current: CaptionToken[] = []
  let chars = 0
  for (const token of tokens) {
    const joined = current.length > 0 ? chars + 1 + token.text.length : token.text.length
    if (current.length > 0 && (current.length >= MAX_WORDS || joined > MAX_CHARS)) {
      groups.push(current)
      current = []
      chars = 0
    }
    current.push(token)
    chars = current.length === 1 ? token.text.length : chars + 1 + token.text.length
    if (SENTENCE_END.test(token.text)) {
      groups.push(current)
      current = []
      chars = 0
    }
  }
  if (current.length > 0)
    groups.push(current)

  // Gapless timing. A page appears the moment its predecessor's last word ends
  // (never later than its own first word — kills the v4 lag where a page with
  // late interpolated timing showed a word behind the voice) and holds until
  // its successor appears (kills the v4 dead-gap blink between pages).
  const starts = groups.map((group, i) =>
    i === 0 ? group[0]!.fromMs : Math.min(groups[i - 1]!.at(-1)!.toMs, group[0]!.fromMs),
  )
  return groups.map((group, i) => ({
    startMs: starts[i]!,
    endMs: i < groups.length - 1 ? starts[i + 1]! : group.at(-1)!.toMs + LAST_PAGE_LINGER_MS,
    tokens: group,
  }))
}

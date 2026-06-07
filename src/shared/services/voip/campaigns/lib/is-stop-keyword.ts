// Pure rule (EPIC decision #16): does an inbound SMS body opt the sender out?
// Composed by the cloudtalk webhook handler. No I/O.
//
// CloudTalk auto-honors STOP on its own side; we mirror to our shared DNC
// registry + unenroll so the rest of the app respects it too. Match the
// standard CTIA/A2P stop keywords, case-insensitive, trimmed, whole-word-ish.

const STOP_KEYWORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'optout',
  'opt-out',
  'revoke',
])

export function isStopKeyword(text: string): boolean {
  if (!text) {
    return false
  }
  // First token, stripped of surrounding punctuation/whitespace, lowercased.
  const firstToken = text
    .trim()
    .toLowerCase()
    .split(/\s+/)[0]
    ?.replace(/[^a-z-]/g, '')
  return firstToken ? STOP_KEYWORDS.has(firstToken) : false
}

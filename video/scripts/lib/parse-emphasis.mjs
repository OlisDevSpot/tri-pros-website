/**
 * `*span*` markup → per-word emphasis flags. Spans may cover multiple words
 * ("*spa feeling*"); punctuation outside the markers stays attached to the
 * word ("*spa feeling*," → "feeling,"). plainScript is what whisper matching
 * and TTS should see — markers stripped, text otherwise identical.
 */
export function parseScriptEmphasis(script) {
  const segments = script.split('*')
  const words = []
  const emphasis = []
  for (let i = 0; i < segments.length; i++) {
    const emphasized = i % 2 === 1
    // Punctuation glues onto the previous word ONLY when it directly abutted
    // the `*` marker that opened this segment ("*spa feeling*, every" →
    // segment ', every' starts with the comma, no leading space → "feeling,").
    // A standalone mid-segment punctuation token like the em-dash pause in
    // "only — see" must stay its own word, matching plain split(/\s+/).
    const afterMarker = i > 0 && !/^\s/.test(segments[i])
    const chunks = segments[i].split(/\s+/)
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c]
      if (!chunk)
        continue
      const gluesToPrevious = c === 0 && afterMarker && /^[.,!?…—-]+$/.test(chunk)
      if (gluesToPrevious && words.length > 0) {
        words[words.length - 1] += chunk
      }
      else {
        words.push(chunk)
        emphasis.push(emphasized)
      }
    }
  }
  return { words, emphasis, plainScript: words.join(' ') }
}

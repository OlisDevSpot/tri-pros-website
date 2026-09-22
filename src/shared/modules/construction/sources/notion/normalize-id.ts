const HEX_32 = /^[0-9a-f]{32}$/

/**
 * Notion page and relation ids are dashed lowercase UUIDs, but undashed forms
 * circulate in hand-written config. Every id comparison in the app is raw
 * string equality or a Map key, so a mismatch silently returns nothing.
 * Normalize at the adapter and at relation-filter inputs.
 *
 * Known un-normalized boundary: the `?trade=` URL query param
 * (see resolve-stage-trade.ts) is tested against a normalized Map without
 * going through this function. Left alone here — that surface belongs to
 * another in-flight change.
 *
 * Anything that is not 32 hex characters (a slug, a display name, an empty
 * string) is trimmed and returned as-is, case intact — this must be safe to
 * call on any string.
 */
export function normalizeNotionId(id: string): string {
  const trimmed = id.trim()
  const compact = trimmed.replace(/-/g, '').toLowerCase()

  if (!HEX_32.test(compact)) {
    return trimmed
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-')
}

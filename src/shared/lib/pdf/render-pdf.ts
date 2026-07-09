import type { Buffer } from 'node:buffer'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import pdfMake from 'pdfmake'

/**
 * pdfmake requires font definitions. We use the 14 standard PDF fonts
 * (Helvetica family) to avoid shipping TTF files with the bundle. These
 * are built into every PDF reader, so file size stays tiny and rendering
 * is universal. The fontDictionary maps the logical font name "Roboto"
 * (used in our styles) to Helvetica — visual result is near-identical
 * for the reference SOW doc.
 */
let fontsConfigured = false
function ensureFontsConfigured() {
  if (fontsConfigured) {
    return
  }
  pdfMake.setFonts({
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  })
  fontsConfigured = true
}

/** Renders a pdfmake doc definition to a Buffer. */
export async function renderPdf(def: TDocumentDefinitions): Promise<Buffer> {
  ensureFontsConfigured()
  const created = pdfMake.createPdf(sanitizeValue(def) as TDocumentDefinitions)
  return created.getBuffer()
}

/**
 * The standard PDF fonts are WinAnsi (CP-1252) encoded — characters outside
 * that set (emoji, CJK) render as garbage glyphs instead of being dropped.
 * Sanitizing the whole doc definition at this single chokepoint means no
 * doc-definition builder has to remember to clean its strings. The keep-set
 * is printable ASCII + Latin-1 + the CP-1252 specials (bullet, en/em dash,
 * curly quotes, euro, trademark, ellipsis), so accented names ("José") and
 * typographic punctuation still render; newlines are preserved.
 * Already-clean strings return by identity — only dirty strings pay for
 * re-normalization (space collapse + per-line edge trim, so "🧪 Name"
 * becomes "Name", not " Name").
 */
function pdfSafeString(value: string): string {
  const stripped = value.replace(/[^\x20-\x7E\u00A0-\u00FF\n€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '')
  if (stripped === value) {
    return value
  }
  return stripped.replace(/ {2,}/g, ' ').replace(/^ +| +$/gm, '')
}

/**
 * Deep-walks the doc definition: strings are sanitized (except `image`
 * values — base64 data URLs, pure ASCII by construction), functions
 * (header/footer builders) are wrapped so their OUTPUT is sanitized too.
 */
function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    return key === 'image' ? value : pdfSafeString(value)
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item))
  }
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    return (...args: unknown[]) => sanitizeValue(fn(...args))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v, k)
    }
    return out
  }
  return value
}

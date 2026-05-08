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
  const created = pdfMake.createPdf(def)
  return created.getBuffer()
}

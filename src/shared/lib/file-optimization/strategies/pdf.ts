// src/shared/lib/file-optimization/strategies/pdf.ts
import type { Buffer } from 'node:buffer'

/**
 * Best-effort page count for a PDF. Returns null (never throws) when the PDF
 * can't be parsed — a page-count failure must not fail the whole optimize; the
 * file is still a usable download.
 *
 * PLAN 1b: add first-page raster → WebP thumbnail here (pdfjs-dist + canvas)
 * and surface a thumbnailPathKey; Plan 1 only reads the page count.
 */
export async function readPdfPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    return doc.getPageCount()
  }
  catch (error) {
    console.warn('[file-optimization] readPdfPageCount failed:', error)
    return null
  }
}

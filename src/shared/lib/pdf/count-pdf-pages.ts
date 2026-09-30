import type { Buffer } from 'node:buffer'

/** Counts pages in a PDF buffer without rendering it. */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}

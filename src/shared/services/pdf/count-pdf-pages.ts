import type { Buffer } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'

/** Counts pages in a PDF buffer without rendering it. */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}

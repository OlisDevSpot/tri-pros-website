/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'

async function main() {
  const doc = await PDFDocument.create()
  for (let i = 0; i < 3; i++) doc.addPage([612, 792])
  const bytes = await doc.save()
  const buf = Buffer.from(bytes)

  const count = await countPdfPages(buf)
  assert.equal(count, 3, `expected 3 pages, got ${count}`)

  console.log('✅ countPdfPages verified')
}

main().catch((err) => { console.error(err); process.exit(1) })

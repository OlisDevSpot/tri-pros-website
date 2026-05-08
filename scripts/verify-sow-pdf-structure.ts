/* eslint-disable no-console */
import { Client } from 'pg'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  const { rows: [p] } = await c.query(
    `SELECT "project_JSON" AS project_json FROM proposals WHERE id = $1`,
    [PROPOSAL_ID],
  )
  await c.end()

  const sow = p?.project_json?.data?.sow ?? []

  console.log('=== SOURCE DATA (from prod DB, proposal baaf55ef) ===')
  console.log(`${sow.length} SOW items:\n`)
  for (let i = 0; i < sow.length; i++) {
    const item = sow[i]
    console.log(`  ${i + 1}. ${item.title}`)
    console.log(`     trade:  ${item.trade.label}`)
    console.log(`     scopes: ${(item.scopes ?? []).map((s: { label: string }) => s.label).join(', ')}`)
    console.log(`     price:  $${item.price}`)
    console.log(`     body:   ${String(item.contentJSON ?? '').length} chars of Tiptap JSON`)
    console.log()
  }

  console.log('\n=== RENDERED PDF STRUCTURE (from /tmp/sow-verification.pdf) ===')
  const pdfBuffer = readFileSync('/tmp/sow-verification.pdf')
  const pdf = await PDFDocument.load(pdfBuffer)
  const pageCount = pdf.getPageCount()
  const sizeKb = (pdfBuffer.length / 1024).toFixed(1)
  console.log(`  ${pageCount} pages, ${sizeKb} KB\n`)

  console.log('  Expected page layout (per sow-doc-definition.ts):')
  console.log('    Page 1: "Scope of Work" title + subtitle + Item #1 (Sod) — title, trade, scopes, body')
  console.log('    Page 2: continuation of Item #1 body (if overflow)')
  console.log('    Page 3: pageBreak:before -> Item #2 (Cabinets) — title, trade, scopes, body')
  console.log('    Page 4: continuation of Item #2 body (if overflow)')
  console.log('')
  console.log('  Actual: ' + pageCount + ' pages')
  if (pageCount === sow.length + Math.max(0, sow.length - 1)) {
    console.log('  -> Matches the paged-by-item layout (each item gets its own starting page)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

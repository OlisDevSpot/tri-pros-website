/* eslint-disable no-console */
import { Client } from 'pg'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'

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
  console.log(`SOW items: ${sow.length}\n`)
  for (let i = 0; i < sow.length; i++) {
    const item = sow[i]
    console.log(`--- item ${i + 1}: "${item.title}" (trade=${item.trade?.label}) ---`)
    console.log(`  scopes:      ${(item.scopes ?? []).map((s: any) => s.label).join(', ')}`)
    console.log(`  price:       ${item.price}`)
    console.log(`  contentJSON length:      ${item.contentJSON?.length ?? 0}`)
    console.log(`  html length:             ${item.html?.length ?? 0}`)
    const asText = sowToPlaintext([item])
    console.log(`  plaintext length:        ${asText.length}`)
    console.log(`  plaintext preview:       ${asText.slice(0, 150).replace(/\n/g, '⏎')}${asText.length > 150 ? '…' : ''}\n`)
  }

  const combined = sowToPlaintext(sow)
  console.log(`\n=== COMBINED ===`)
  console.log(`total plaintext length:  ${combined.length}`)
  console.log(`sow-1 (slice 0..2000):   ${combined.slice(0, 2000).length} chars`)
  console.log(`sow-2 (slice 2000..):    ${combined.slice(2000).length} chars`)
  console.log(`\n--- full plaintext (first 500 chars) ---`)
  console.log(combined.slice(0, 500))
  console.log(`--- last 300 chars ---`)
  console.log(combined.slice(-300))
}
main().catch(e => { console.error(e); process.exit(1) })

import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import './lib/load-env'

/**
 * Pre-drop snapshot of customers.notion_contact_id (Notion retirement rider,
 * commit 14dbd44b). Run IMMEDIATELY before the Wave-1 prod cutover push, which
 * drops the column. Deliberately reads DATABASE_URL (PROD) — this is a
 * read-only export and the values exist nowhere else after the drop.
 * see docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url)
    throw new Error('DATABASE_URL not set')
  const sql = neon(url)
  const rows = await sql`
    SELECT id AS customer_id, name, notion_contact_id
    FROM customers WHERE notion_contact_id IS NOT NULL ORDER BY name`
  const out = {
    exportedAt: new Date().toISOString(),
    source: 'prod pre-drop snapshot (Wave-1 cutover)',
    count: rows.length,
    rows,
  }
  const file = `notion-contact-id-snapshot-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`wrote ${rows.length} rows to ${file}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

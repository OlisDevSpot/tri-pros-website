/**
 * Diagnostic (read-only): scan every text/varchar/jsonb column in the DB for
 * R2-related URLs, grouped by table.column x domain. Zero writes.
 *
 *   pnpm tsx <path>/scan-r2-urls.ts                     # dev
 *   DRIZZLE_TARGET=prod pnpm tsx <path>/scan-r2-urls.ts # prod (read-only)
 */
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local' })
config()

const IS_PROD_TARGET = process.env.DRIZZLE_TARGET === 'prod'
const DATABASE_URL = IS_PROD_TARGET ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error('No database URL for target')
  process.exit(1)
}
console.log(`target=${IS_PROD_TARGET ? 'prod' : 'dev'} host=${new URL(DATABASE_URL).host}\n`)

const DOMAINS: Record<string, string> = {
  'portfolio OLD (pub-06be62a0…r2.dev)': '%pub-06be62a0a47b42cbb944ba281f4df793.r2.dev%',
  'company-docs (pub-e9f58ace…r2.dev)': '%pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev%',
  'any other r2.dev': '%r2.dev%',
  'S3 API endpoint (r2.cloudflarestorage.com)': '%r2.cloudflarestorage.com%',
  'NEW CDN (media.triprosremodeling.com)': '%media.triprosremodeling.com%',
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })
  const { rows: cols } = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'jsonb')
    ORDER BY table_name, column_name
  `)
  console.log(`scanning ${cols.length} text/varchar/jsonb columns...\n`)

  const hits: string[] = []
  for (const c of cols) {
    const expr = c.data_type === 'jsonb' ? `"${c.column_name}"::text` : `"${c.column_name}"`
    for (const [label, pattern] of Object.entries(DOMAINS)) {
      const { rows: [r] } = await pool.query(
        `SELECT count(*)::int AS n FROM "${c.table_name}" WHERE ${expr} LIKE $1`,
        [pattern],
      )
      if (r.n > 0) hits.push(`${r.n.toString().padStart(6)}  ${c.table_name}.${c.column_name} (${c.data_type})  →  ${label}`)
    }
  }

  console.log(hits.length ? hits.join('\n') : 'NO R2-related URLs found anywhere.')
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })

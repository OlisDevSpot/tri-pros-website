import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import env from '../src/shared/config/server-env'
import * as schema from '../src/shared/db/schema'

const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

async function main() {
  const target = process.env.DRIZZLE_TARGET === 'dev' ? 'DEV' : 'PROD'
  console.warn(`\nBackfilling customers.lead_source_id against ${target}…\n`)

  // Count before
  const beforeRes = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM customers
    WHERE lead_source IS NOT NULL AND lead_source_id IS NULL
  `)
  console.warn(`Rows with legacy lead_source but no FK: ${beforeRes.rows[0]?.count ?? 0}`)

  // Backfill: match customers.lead_source::text to lead_sources.slug
  const result = await db.execute(sql`
    UPDATE customers c
    SET lead_source_id = ls.id
    FROM lead_sources ls
    WHERE c.lead_source::text = ls.slug
      AND c.lead_source_id IS NULL
  `)
  console.warn(`Updated ${result.rowCount ?? 0} rows`)

  // Verify: any customers with lead_source set but still no lead_source_id?
  const orphansRes = await db.execute<{ lead_source: string, count: number }>(sql`
    SELECT lead_source::text AS lead_source, COUNT(*)::int AS count
    FROM customers
    WHERE lead_source IS NOT NULL AND lead_source_id IS NULL
    GROUP BY lead_source
  `)
  if (orphansRes.rows.length > 0) {
    console.warn(`\nWARNING: unmatched legacy enum values:`)
    for (const row of orphansRes.rows) {
      console.warn(`  - ${row.lead_source}: ${row.count} customer(s)`)
    }
    console.warn(`Run seed-lead-sources.ts first, or investigate.`)
  }
  else {
    console.warn('\nAll rows with legacy lead_source are now linked via FK.')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

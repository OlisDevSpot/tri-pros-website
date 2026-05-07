/* eslint-disable no-console */
/**
 * Read-only verification of the proposal-kind hotfix.
 *
 * Confirms the dev (or prod) DB is in the post-migration state:
 *   - new partial unique index exists
 *   - old partial unique index does NOT exist
 *   - kind totals + kind × status cross-tab look sane
 *   - no meeting has 2+ approved initial-sales (i.e. the new invariant holds)
 *
 * Usage:
 *   pnpm tsx scripts/verify-proposal-kind.ts          # dev DB
 *   NODE_ENV=production pnpm tsx scripts/verify-proposal-kind.ts   # prod DB
 *
 * No writes, no transactions — safe to run any time, including against prod.
 */
import './lib/load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'

const NEW_INDEX = 'proposals_one_approved_initial_sale_per_meeting_idx'
const OLD_INDEX = 'proposals_one_initial_sale_per_meeting_idx'

async function main() {
  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'
  console.log(`\nNODE_ENV=${process.env.NODE_ENV ?? 'undefined'} → ${env} DB\n`)

  console.log(`[1] Index presence`)
  const newIdx = await db.execute(sql`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ${NEW_INDEX}
  `)
  const oldIdx = await db.execute(sql`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ${OLD_INDEX}
  `)
  console.log(`    ${NEW_INDEX}: ${newIdx.rows.length > 0 ? 'PRESENT' : 'MISSING'}`)
  if (newIdx.rows.length > 0) {
    console.log(`      defn: ${(newIdx.rows[0] as { indexdef: string }).indexdef}`)
  }
  console.log(`    ${OLD_INDEX}: ${oldIdx.rows.length === 0 ? 'absent (good)' : 'STILL PRESENT (bad)'}`)

  console.log(`\n[2] Totals by kind`)
  const totals = await db.execute(sql`
    SELECT kind, COUNT(*)::int AS count
    FROM proposals
    GROUP BY kind
    ORDER BY kind
  `)
  console.log(`    `, totals.rows)

  console.log(`\n[3] Cross-tab kind × status`)
  const cross = await db.execute(sql`
    SELECT kind, status, COUNT(*)::int AS count
    FROM proposals
    GROUP BY kind, status
    ORDER BY kind, status
  `)
  console.log(`    `, cross.rows)

  console.log(`\n[4] Approved initial-sale invariant (must be 0 rows)`)
  const dupes = await db.execute(sql`
    SELECT meeting_id, COUNT(*)::int AS approved_count
    FROM proposals
    WHERE kind = 'initial-sale' AND status = 'approved'
    GROUP BY meeting_id
    HAVING COUNT(*) > 1
  `)
  if (dupes.rows.length === 0) {
    console.log(`     OK — no meeting has 2+ approved initial-sales`)
  }
  else {
    console.log(`     VIOLATION:`, dupes.rows)
  }

  console.log(`\n[5] Sanity — orphan proposals (NULL meeting_id)`)
  const orphans = await db.execute(sql`
    SELECT COUNT(*)::int AS orphans FROM proposals WHERE meeting_id IS NULL
  `)
  console.log(`    `, orphans.rows)

  process.exit(0)
}

main().catch((err) => {
  console.error('\n[verify] FAILED:', err)
  process.exit(1)
})

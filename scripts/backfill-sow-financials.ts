/**
 * One-time backfill: migrate legacy `sow[].price` → `sow[].financials`.
 *
 * Legacy proposals stored a flat `price?: number` on each SOW section.
 * Issue #159 replaces this with `financials: { sectionPrice, costLines }`.
 * New code expects the `financials` key — legacy rows crash without it.
 *
 * Runs a single UPDATE statement — no per-row round trips. Idempotent:
 * the WHERE clause skips proposals that are already migrated.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-sow-financials.ts          # dev DB
 *   NODE_ENV=production pnpm tsx scripts/backfill-sow-financials.ts  # prod DB
 *
 * Add --dry-run to preview without writing:
 *   pnpm tsx scripts/backfill-sow-financials.ts --dry-run
 */
import './lib/load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { describeTargetDb } from './lib/describe-target-db'

// Matches proposals with any SOW section missing `financials` entirely
// OR missing the `incentives` key inside `financials`.
const LEGACY_WHERE = sql`EXISTS (
  SELECT 1
  FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS s
  WHERE s->'financials' IS NULL
     OR s->'financials'->'incentives' IS NULL
)`

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { env, host } = describeTargetDb()

  console.log(`--- BACKFILL SOW FINANCIALS${dryRun ? ' (dry run)' : ''} ---`)
  console.log(`NODE_ENV: ${env}`)
  console.log(`DB host:  ${host}`)
  console.log('')

  // Count legacy rows first (cheap — reused for dry-run and pre-check).
  const [{ count: before }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposals)
    .where(LEGACY_WHERE)

  console.log(`Found ${before} proposal(s) with legacy SOW data.`)

  if (before === 0) {
    console.log('Nothing to migrate.')
    process.exit(0)
  }

  if (dryRun) {
    console.log(`[dry-run] Would migrate ${before} proposal(s). No writes performed.`)
    process.exit(0)
  }

  // Single UPDATE: for each SOW section missing `financials`, move
  // `price` into `financials.sectionPrice` and add empty `costLines`.
  // Sections that already have `financials` pass through unchanged.
  const result = await db.execute(sql`
    UPDATE ${proposals}
    SET "project_JSON" = jsonb_set(
      "project_JSON",
      '{data,sow}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN NOT (s ? 'financials') THEN
              (s - 'price') || jsonb_build_object(
                'financials', jsonb_build_object(
                  'sectionPrice', CASE WHEN s->>'price' IS NOT NULL
                                       THEN (s->>'price')::numeric
                                       ELSE null
                                  END,
                  'costLines', '[]'::jsonb,
                  'incentives', '[]'::jsonb
                )
              )
            WHEN s->'financials'->'incentives' IS NULL THEN
              jsonb_set(s, '{financials,incentives}', '[]'::jsonb)
            ELSE s
          END
        )
        FROM jsonb_array_elements("project_JSON"->'data'->'sow') AS s
      )
    )
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements("project_JSON"->'data'->'sow') AS el
      WHERE el->'financials' IS NULL
         OR el->'financials'->'incentives' IS NULL
    )
  `)

  console.log(`Updated ${result.rowCount ?? 0} proposal(s).`)

  // Verify: no legacy rows remain.
  const [{ count: after }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposals)
    .where(LEGACY_WHERE)

  if (after > 0) {
    console.error(`\nFAIL: ${after} proposal(s) still have legacy SOW data.`)
    process.exit(1)
  }
  console.log('Verification passed — no legacy SOW data remains.')

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

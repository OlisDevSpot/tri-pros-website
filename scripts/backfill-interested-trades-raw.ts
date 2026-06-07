/* eslint-disable no-console */
/**
 * One-shot backfill: populate `customers.leadMetaJSON.interestedTradesRaw` for
 * pre-existing leads that have the old `requestedTrades` (app-trade ids) but no
 * `interestedTradesRaw` (the new human-readable envelope the CloudTalk attribute
 * builder reads).
 *
 * WHY: the lead-intake-normalization change switched CT trade attributes
 * (`primary_trade` / `trades_interested`) to read `leadMetaJSON.interestedTradesRaw`.
 * New leads (Bina webhook + in-app form) populate it at creation time. Leads
 * created BEFORE that change only have `requestedTrades` (tradeId + scopeIds),
 * so they would enroll with EMPTY CT trade attributes. This resolves their
 * tradeIds → trade names (via Notion construction-data) and writes
 * `interestedTradesRaw` so they enroll with readable attributes.
 *
 * Idempotent + re-runnable:
 *   - skips customers with no `requestedTrades`
 *   - skips customers that already have a non-empty `interestedTradesRaw`
 *   - resolving the same data twice yields the same result
 *
 * Target DB is chosen by NODE_ENV (the runtime db client reads DATABASE_URL vs
 * DATABASE_DEV_URL by NODE_ENV — see memory/feedback-runtime-db-env):
 *   dev :  pnpm backfill:trades:dev      (or: tsx scripts/backfill-interested-trades-raw.ts)
 *   prod:  pnpm backfill:trades          (NODE_ENV=production)
 *
 * Flags:
 *   --dry-run   report what WOULD change; write nothing.
 *
 * Run AFTER the lead-intake-normalization change is deployed, at prod-push time.
 * Dev typically needs no backfill (test data), but the script is safe to run there.
 */
import './lib/load-env'
import { eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { constructionDataService } from '@/shared/services/construction-data.service'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const target = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'dev'
  console.log(`[backfill:trades] target=${target}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`)

  // tradeId → name map (exact lookup; the picked ids are real app trades).
  const allTrades = await constructionDataService.getTrades()
  const nameById = new Map(allTrades.map(t => [t.id, t.name]))
  console.log(`[backfill:trades] loaded ${allTrades.length} trades`)

  // Pull every customer that has any leadMetaJSON; filter the rest in JS (the
  // population is small and jsonb-path SQL filtering buys little here).
  const rows = await db
    .select({ id: customers.id, name: customers.name, leadMetaJSON: customers.leadMetaJSON })
    .from(customers)
    .where(isNotNull(customers.leadMetaJSON))

  let candidates = 0
  let updated = 0
  let skippedHasRaw = 0
  let skippedNoTrades = 0
  let unmatchedTradeIds = 0

  for (const row of rows) {
    const meta = row.leadMetaJSON
    if (!meta) {
      continue
    }

    const requested = meta.requestedTrades ?? []
    if (requested.length === 0) {
      skippedNoTrades++
      continue
    }
    if (meta.interestedTradesRaw && meta.interestedTradesRaw.length > 0) {
      skippedHasRaw++
      continue
    }

    candidates++
    const names: string[] = []
    for (const t of requested) {
      const name = nameById.get(t.tradeId)
      if (name) {
        names.push(name)
      }
      else {
        unmatchedTradeIds++
      }
    }

    if (names.length === 0) {
      console.warn(`  - ${row.name} (${row.id}): ${requested.length} tradeId(s), none resolved — skipping`)
      continue
    }

    const nextMeta = { ...meta, interestedTradesRaw: names }
    console.log(`  ${DRY_RUN ? '[would set]' : '[set]'} ${row.name} (${row.id}) → ${names.join(', ')}`)

    if (!DRY_RUN) {
      // updatedAt auto-bumps via the schema-helper $onUpdate — do not set it.
      await db.update(customers).set({ leadMetaJSON: nextMeta }).where(eq(customers.id, row.id))
    }
    updated++
  }

  console.log('[backfill:trades] summary', {
    scanned: rows.length,
    candidates,
    updated: DRY_RUN ? 0 : updated,
    wouldUpdate: DRY_RUN ? updated : undefined,
    skippedAlreadyHasRaw: skippedHasRaw,
    skippedNoRequestedTrades: skippedNoTrades,
    unmatchedTradeIds,
  })
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill:trades] failed', err)
  process.exit(1)
})

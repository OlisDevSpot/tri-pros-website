/* eslint-disable no-console */
/**
 * One-shot backfill: normalize every `customers.phone` to the canonical storage
 * shape — bare 10-digit national (e.g. "8186511445").
 *
 * WHY: historically nothing normalized phone at the write boundary, so the
 * column accumulated a mix of E.164 ("+18186511445"), raw 10-digit, and
 * display-formatted ("(818) 651-1445") values. New writes are now normalized at
 * the DB boundary (optionalPhoneSchema on the customer insert/update schema —
 * see @/shared/lib/phone), so this only needs to fix pre-existing rows.
 *
 * Idempotent + re-runnable:
 *   - skips rows already in canonical 10-digit shape
 *   - skips null/empty phones
 *   - leaves UNPARSEABLE values untouched and reports them (never destroys data)
 *
 * Target DB is chosen by NODE_ENV (the runtime db client reads DATABASE_URL vs
 * DATABASE_DEV_URL by NODE_ENV — see memory/feedback-runtime-db-env):
 *   dev :  pnpm backfill:phones:dev        (or: tsx scripts/normalize-customer-phones.ts)
 *   prod:  pnpm backfill:phones            (NODE_ENV=production)
 *
 * SAFE BY DEFAULT — dry-run unless `--apply` is passed:
 *   pnpm backfill:phones:dev               # preview dev changes
 *   pnpm backfill:phones:dev -- --apply    # write dev
 *   pnpm backfill:phones                    # preview PROD changes
 *   pnpm backfill:phones -- --apply         # write PROD
 */
import './lib/load-env'
import { eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { toNationalDigits } from '@/shared/lib/phone'

const APPLY = process.argv.includes('--apply')

async function main() {
  const target = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'dev'
  console.log(`[backfill:phones] target=${target}${APPLY ? '' : ' (DRY RUN — no writes; pass --apply to write)'}`)

  const rows = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(isNotNull(customers.phone))

  let updated = 0
  let skippedCanonical = 0
  let unparseable = 0

  for (const row of rows) {
    const next = toNationalDigits(row.phone)

    if (next === null) {
      unparseable++
      console.warn(`  [unparseable] ${row.name} (${row.id}): "${row.phone}" — left untouched`)
      continue
    }
    if (next === row.phone) {
      skippedCanonical++
      continue
    }

    console.log(`  ${APPLY ? '[set]' : '[would set]'} ${row.name} (${row.id}): "${row.phone}" → "${next}"`)
    if (APPLY) {
      // updatedAt auto-bumps via the schema-helper $onUpdate — do not set it.
      await db.update(customers).set({ phone: next }).where(eq(customers.id, row.id))
    }
    updated++
  }

  console.log('[backfill:phones] summary', {
    scanned: rows.length,
    skippedAlreadyCanonical: skippedCanonical,
    unparseable,
    updated: APPLY ? updated : 0,
    wouldUpdate: APPLY ? undefined : updated,
  })
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill:phones] failed', err)
  process.exit(1)
})

/**
 * Two fixes for rows written before the deposit cap: a stored deposit of exactly $1,000 is cleared so the row follows
 * the legal cap, and a cash down the create form stamped all-cash gets the deposit default, unless the meeting's deal
 * was cash. Locked (frozen) proposals are skipped.
 *
 * Target DB is chosen by DRIZZLE_TARGET; dry run unless `--apply` is passed:
 *   dev :  pnpm tsx scripts/backfill-proposal-cash-down.ts            (preview)
 *          pnpm tsx scripts/backfill-proposal-cash-down.ts --apply    (write dev)
 *   prod:  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-cash-down.ts            (preview)
 *          DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-cash-down.ts --apply    (write PROD)
 */
import './lib/load-env'
// eslint-disable-next-line perfectionist/sort-imports -- the env loader above must run before the db client is imported
import process from 'node:process'
import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { getDefaultCashDown, isAllCash, resolveDeposit } from '@/shared/modules/proposals/core/lib/financials'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

const APPLY = process.argv.includes('--apply')

// The create form's default before the cap existed, so a row still holding it reads as an agent override it never was.
const OLD_DEFAULT_DEPOSIT_CENTS = 100_000

async function main() {
  const target = process.env.DRIZZLE_TARGET === 'prod' ? 'PRODUCTION' : 'dev'
  console.log(`[backfill:proposal-cash-down] target=${target}${APPLY ? '' : ' (DRY RUN — no writes; pass --apply to write)'}`)

  const rows = await db
    .select({
      id: proposals.id,
      finalTcpCents: proposals.finalTcpCents,
      cashInDealCents: proposals.cashInDealCents,
      depositAmountCents: proposals.depositAmountCents,
      status: proposals.status,
      contractEnvelopeId: proposals.contractEnvelopeId,
      contractSentAt: proposals.contractSentAt,
      contractSignedAt: proposals.contractSignedAt,
      contractDeclinedAt: proposals.contractDeclinedAt,
      flowState: meetings.flowStateJSON,
    })
    .from(proposals)
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(isNotNull(proposals.finalTcpCents), isNotNull(proposals.cashInDealCents)))

  const changes = rows.flatMap((row) => {
    if (isProposalFrozen(row)) {
      return []
    }
    const finalTcp = (row.finalTcpCents ?? 0) / 100
    const cashCents = row.cashInDealCents ?? 0
    const meetingWasCash = row.flowState?.dealStructure?.mode === 'cash'
    const depositTo = row.depositAmountCents === OLD_DEFAULT_DEPOSIT_CENTS ? null : row.depositAmountCents
    const deposit = resolveDeposit(depositTo == null ? null : depositTo / 100, finalTcp)
    const cashTo = isAllCash(cashCents / 100, finalTcp) && !meetingWasCash
      ? Math.round(getDefaultCashDown(finalTcp, deposit) * 100)
      : cashCents
    if (depositTo === row.depositAmountCents && cashTo === cashCents) {
      return []
    }
    return [{ id: row.id, depositFrom: row.depositAmountCents, depositTo, cashFrom: cashCents, cashTo }]
  })

  console.table(changes)
  console.log(`${changes.length} of ${rows.length} proposals ${APPLY ? 'changing' : 'would change'}.`)
  if (!APPLY) {
    process.exit(0)
  }
  for (const change of changes) {
    await db
      .update(proposals)
      .set({ depositAmountCents: change.depositTo, cashInDealCents: change.cashTo })
      .where(eq(proposals.id, change.id))
  }
  console.log('Applied.')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

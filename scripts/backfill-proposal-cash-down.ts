/**
 * Two fixes for rows written before the deposit cap. A stored deposit of exactly $1,000 is the old create default, not
 * an agent override, so it is cleared and the row follows the legal cap. A cash down at the full price was stamped by
 * the old create form, so it moves to the deposit default, unless the meeting's deal was cash.
 *
 * The old proposal page also let a homeowner pick all cash, which looks the same as the stamped default, so the cash
 * change only touches proposals never sent unless `--include-sent` is passed; the tables show status, sent date and
 * views so the owner can judge each one. Locked (frozen) proposals are skipped. A write lands only while the row still
 * holds the values read and is still unlocked, so an edit, a homeowner's pick or a contract made after the read wins.
 *
 * Target DB is chosen by DRIZZLE_TARGET; dry run unless `--apply` is passed:
 *   dev :  pnpm tsx scripts/backfill-proposal-cash-down.ts                    (preview)
 *          pnpm tsx scripts/backfill-proposal-cash-down.ts --apply            (write dev)
 *   prod:  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-cash-down.ts            (preview)
 *          DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-cash-down.ts --apply    (write PROD)
 *   add `--include-sent` to also move the cash down on proposals already sent.
 */
import './lib/load-env'
// eslint-disable-next-line perfectionist/sort-imports -- the env loader above must run before the db client is imported
import process from 'node:process'
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { getDefaultCashDown, isAllCash, resolveDeposit } from '@/shared/modules/proposals/core/lib/financials'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

const APPLY = process.argv.includes('--apply')
const INCLUDE_SENT = process.argv.includes('--include-sent')

// The create form's default before the cap existed, so a row still holding it reads as an agent override it never was.
const OLD_DEFAULT_DEPOSIT_CENTS = 100_000

// The SQL twin of isProposalFrozen, checked again at write time.
const stillUnlocked = and(
  ne(proposals.status, 'approved'),
  isNull(proposals.contractSignedAt),
  isNull(proposals.contractDeclinedAt),
  isNull(proposals.contractSentAt),
  isNull(proposals.contractEnvelopeId),
)

async function main() {
  const target = process.env.DRIZZLE_TARGET === 'prod' ? 'PRODUCTION' : 'dev'
  console.log(`[backfill:proposal-cash-down] target=${target}${APPLY ? '' : ' (DRY RUN — no writes; pass --apply to write)'}${INCLUDE_SENT ? ' --include-sent' : ''}`)

  const rows = await db
    .select({
      id: proposals.id,
      finalTcpCents: proposals.finalTcpCents,
      cashInDealCents: proposals.cashInDealCents,
      depositAmountCents: proposals.depositAmountCents,
      status: proposals.status,
      sentAt: proposals.sentAt,
      views: sql<number>`(select count(*) from ${proposalViews} where ${proposalViews.proposalId} = ${proposals.id})`.mapWith(Number),
      contractEnvelopeId: proposals.contractEnvelopeId,
      contractSentAt: proposals.contractSentAt,
      contractSignedAt: proposals.contractSignedAt,
      contractDeclinedAt: proposals.contractDeclinedAt,
      flowState: meetings.flowStateJSON,
    })
    .from(proposals)
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(isNotNull(proposals.finalTcpCents), isNotNull(proposals.cashInDealCents)))

  const changes = []
  const held = []
  for (const row of rows) {
    if (isProposalFrozen(row) || row.finalTcpCents == null || row.cashInDealCents == null) {
      continue
    }
    const finalTcp = row.finalTcpCents / 100
    const cashFrom = row.cashInDealCents
    const meetingWasCash = row.flowState?.dealStructure?.mode === 'cash'
    const depositTo = row.depositAmountCents === OLD_DEFAULT_DEPOSIT_CENTS ? null : row.depositAmountCents
    const deposit = resolveDeposit(depositTo == null ? null : depositTo / 100, finalTcp)
    const cashCandidate = isAllCash(cashFrom / 100, finalTcp) && !meetingWasCash
      ? Math.round(getDefaultCashDown(finalTcp, deposit) * 100)
      : cashFrom
    const neverSent = row.sentAt == null && row.status === 'draft'
    const cashTo = neverSent || INCLUDE_SENT ? cashCandidate : cashFrom
    const facts = { id: row.id, status: row.status, sentAt: row.sentAt ?? '', views: row.views }
    if (cashTo !== cashCandidate) {
      held.push({ ...facts, cashFrom, cashWithIncludeSent: cashCandidate })
    }
    if (depositTo === row.depositAmountCents && cashTo === cashFrom) {
      continue
    }
    changes.push({ ...facts, finalTcpCents: row.finalTcpCents, depositFrom: row.depositAmountCents, depositTo, cashFrom, cashTo })
  }

  console.table(changes)
  console.log(`${changes.length} of ${rows.length} proposals ${APPLY ? 'changing' : 'would change'}.`)
  if (held.length > 0) {
    console.log(`Cash down held on ${held.length} sent proposals (a homeowner may have picked all cash); pass --include-sent to move them:`)
    console.table(held)
  }
  if (!APPLY) {
    process.exit(0)
  }

  const skipped = []
  let applied = 0
  for (const change of changes) {
    const touched = await db
      .update(proposals)
      .set({ depositAmountCents: change.depositTo, cashInDealCents: change.cashTo })
      .where(and(
        eq(proposals.id, change.id),
        eq(proposals.cashInDealCents, change.cashFrom),
        change.depositFrom == null ? isNull(proposals.depositAmountCents) : eq(proposals.depositAmountCents, change.depositFrom),
        eq(proposals.finalTcpCents, change.finalTcpCents),
        stillUnlocked,
      ))
      .returning({ id: proposals.id })
    if (touched.length === 0) {
      skipped.push(change)
    }
    else {
      applied += touched.length
    }
  }
  console.log(`Applied ${applied} of ${changes.length}.`)
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length}: changed or locked since the read.`)
    console.table(skipped)
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

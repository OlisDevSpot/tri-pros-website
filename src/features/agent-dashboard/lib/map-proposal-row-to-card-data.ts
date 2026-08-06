import type { ProposalOverviewCardData } from '@/shared/entities/proposals/components/overview-card'
import type { ProposalListRow } from '@/shared/entities/proposals/dal/server/queries'

/**
 * Maps a `ProposalListRow` (raw proposal columns + view/customer joins) to
 * the shape `ProposalOverviewCard` expects. `trade`, `value`, and
 * `sowSummary` aren't selected columns on the list query — `getTableColumns`
 * only spreads the raw `proposals` row, so `trade`/`sowSummary` come from the
 * same `projectJSON.data.sow` shape the customer-profile DAL parses
 * server-side (`get-customer-profile.ts`), just derived here client-side
 * since the row already ships the full `projectJSON`. `value` is the same
 * `finalTcpCents / 100` rollup used everywhere else.
 */
export function mapProposalRowToCardData(row: ProposalListRow): ProposalOverviewCardData {
  const sow = row.projectJSON.data.sow

  const sowSummary = sow
    .filter(section => Boolean(section.trade?.label))
    .map(section => ({
      trade: section.trade.label,
      scopes: section.scopes.map(scope => scope.label).filter(Boolean),
    }))

  return {
    id: row.id,
    token: row.token,
    status: row.status,
    label: row.label,
    // `contractSentAt`, not `sentAt` — this roster is filtered by
    // `awaitingSignature` (contract out, unsigned/undeclined; see
    // `awaitingProposalsInput`), so "time since sent" here means since the
    // *contract* went out. The proposal and contract lifecycles are
    // independent (see entities/proposals/DOCS.md#proposal-contract-independence),
    // so `sentAt` (proposal review link shared) can predate `contractSentAt`
    // by days or weeks and would understate urgency if used instead.
    createdAt: row.contractSentAt ?? row.createdAt,
    sentAt: row.sentAt,
    trade: sow[0]?.trade.label ?? null,
    value: (row.finalTcpCents ?? 0) / 100,
    viewCount: row.viewCount,
    sowSummary,
  }
}

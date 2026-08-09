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
export function mapProposalRowToCardData(
  row: ProposalListRow,
  timeSince: 'contractSentAt' | 'sentAt' = 'contractSentAt',
): ProposalOverviewCardData {
  const sow = row.projectJSON.data.sow

  const sowSummary = sow
    .filter(section => Boolean(section.trade.label))
    .map(section => ({
      trade: section.trade.label,
      scopes: section.scopes.map(scope => scope.label).filter(Boolean),
    }))

  return {
    id: row.id,
    token: row.token,
    status: row.status,
    label: row.label,
    // The card's "time since" is section-specific: the Out-for-signature roster
    // measures since the *contract envelope* went out (`contractSentAt`), while
    // the Sent — awaiting response roster measures since the *proposal* was sent
    // (`sentAt`). The two lifecycles are independent
    // (see entities/proposals/DOCS.md#proposal-contract-independence).
    createdAt: (timeSince === 'sentAt' ? row.sentAt : row.contractSentAt) ?? row.createdAt,
    sentAt: row.sentAt,
    trade: sow[0]?.trade.label ?? null,
    value: (row.finalTcpCents ?? 0) / 100,
    viewCount: row.viewCount,
    sowSummary,
  }
}

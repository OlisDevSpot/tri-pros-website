import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

/**
 * Strip the "a proposal exists" existence signal from list items for actors
 * without `read Proposal` (dispatchers). Value/count/list are already emptied
 * by the SQL proposal-scope gate in each builder; this covers the residual
 * boolean badge, which is derived independently via `hasSentProposalSql()`.
 * see docs/plans/2026-08-20-dispatcher-visibility-corrections.md
 */
export function maskFinancials(items: CustomerPipelineItem[], canReadProposals: boolean): CustomerPipelineItem[] {
  if (canReadProposals) {
    return items
  }
  return items.map(item => ({ ...item, hasSentProposal: false }))
}

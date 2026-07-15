// Proposal incentive row ↔ domain mappers (Wave 2 child table). Rows are
// integer cents at the DAL boundary; domain shape (Incentive) is dollars —
// same convention as the rest of the funding form. see ../DOCS.md#final-tcp-derived

import type { InsertProposalIncentive, ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { Incentive } from '@/shared/entities/proposals/schemas'

/** Rows → domain shape (dollars). Sorted by position; W2 handles GLOBAL rows only. */
export function incentiveRowsToDomain(rows: ProposalIncentiveRow[]): Incentive[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map(row => row.type === 'discount'
      ? {
          type: 'discount' as const,
          amount: (row.amountCents ?? 0) / 100,
          ...(row.notes != null ? { notes: row.notes } : {}),
          ...(row.expiresAt != null ? { expiresAt: row.expiresAt } : {}),
        }
      : {
          type: 'exclusive-offer' as const,
          offer: row.offer ?? '',
          ...(row.notes != null ? { notes: row.notes } : {}),
          ...(row.expiresAt != null ? { expiresAt: row.expiresAt } : {}),
        })
}

/** Domain (dollars) → insert rows (integer cents). Array index = position. */
export function domainIncentivesToRows(proposalId: string, incentives: Incentive[]): InsertProposalIncentive[] {
  return incentives.map((inc, i) => ({
    proposalId,
    sowItemId: null,
    type: inc.type,
    position: i,
    label: null,
    amountCents: inc.type === 'discount' ? Math.round(inc.amount * 100) : null,
    offer: inc.type === 'exclusive-offer' ? inc.offer : null,
    notes: inc.notes ?? null,
    expiresAt: inc.expiresAt ?? null,
  }))
}

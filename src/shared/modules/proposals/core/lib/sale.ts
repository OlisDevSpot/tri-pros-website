import type { ProposalKind, ProposalStatus } from '@/shared/constants/enums/proposals'

/** Signing the contract (Zoho completion) or a manual approve is what makes a sale. */
export const SALE_STATUS = 'approved' as const satisfies ProposalStatus

export type SaleKind = 'new' | 'upsell'

export interface SaleClassification {
  kind: SaleKind
  at: string | null
  valueCents: number | null
}

/**
 * Dated at approval with no fallback date, and a null value stays null (not
 * computed, not $0): an undated or unpriced sale must surface as a data fix.
 */
export function classifySale(row: { kind: ProposalKind, approvedAt: string | null, finalTcpCents: number | null }): SaleClassification {
  return {
    kind: row.kind === 'initial-sale' ? 'new' : 'upsell',
    at: row.approvedAt,
    valueCents: row.finalTcpCents,
  }
}

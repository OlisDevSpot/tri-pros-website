import type { ProposalIncentiveRow } from '@/shared/db/schema'
import type { FundingData } from '@/shared/entities/proposals/schemas'

import { incentiveRowsToDomain } from '@/shared/entities/proposals/lib/incentive-rows'

interface FundingSourceRow {
  startingTcpCents: number | null
  depositAmountCents: number | null
  cashInDealCents: number | null
  miscPriceCents: number | null
  incentives: ProposalIncentiveRow[]
}

export interface FundingColumns {
  startingTcpCents: number
  depositAmountCents: number
  cashInDealCents: number
  miscPriceCents: number | null
}

/** THE only sanctioned way to build façade inputs from a server row
 *  (cents columns + incentive rows → flat dollars `FundingData`, derived
 *  JIT at the call site — Option 3 ruling 2026-07-27; NEVER materialized on
 *  the row). Takes the whole row-shape on purpose: hand-rolling this and
 *  forgetting `incentives` silently inflates finalTcp. Live RHF form state
 *  is the only other legitimate `FundingData` source. */
export function toFundingInputs(row: FundingSourceRow): FundingData {
  return {
    startingTcp: (row.startingTcpCents ?? 0) / 100,
    depositAmount: (row.depositAmountCents ?? 0) / 100,
    cashInDeal: (row.cashInDealCents ?? 0) / 100,
    ...(row.miscPriceCents == null ? {} : { miscPrice: row.miscPriceCents / 100 }),
    incentives: incentiveRowsToDomain(row.incentives),
  }
}

/** Form dollars → column cents. Incentives are NOT here — they are rows
 *  (replaceProposalIncentives). */
export function fundingDomainToColumns(
  data: Pick<FundingData, 'startingTcp' | 'depositAmount' | 'cashInDeal' | 'miscPrice'>,
): FundingColumns {
  return {
    startingTcpCents: Math.round(data.startingTcp * 100),
    depositAmountCents: Math.round(data.depositAmount * 100),
    cashInDealCents: Math.round(data.cashInDeal * 100),
    miscPriceCents: data.miscPrice == null ? null : Math.round(data.miscPrice * 100),
  }
}

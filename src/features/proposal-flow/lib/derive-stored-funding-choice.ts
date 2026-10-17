import type { PaymentScheduleRow } from '@/shared/modules/proposals/core/lib/financials'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { canFinance, clampFinancedCashDown, computeFinalTcp, computePaymentSchedule, isAllCash, resolveDeposit, roundToCents } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'

export type StoredFundingSource = Parameters<typeof toFundingInputs>[0] & {
  projectJSON: { data: { sow: SOW[] } }
  financeOptionId: number | null
}

export interface StoredFundingChoice {
  finalTcp: number
  deposit: number
  canFinance: boolean
  allCash: boolean
  /** The column as stored, which may sit outside the bounds on an old row. */
  storedCash: number
  /** The stored cash down pulled inside the bounds and rounded to the cent. */
  cash: number
  financed: number
  selectedOptionId: number | null
  schedule: PaymentScheduleRow[]
}

// Rounded to the cent, so a stored value already inside the bounds equals `cash` and opening the page writes nothing.
export function deriveStoredFundingChoice(proposal: StoredFundingSource): StoredFundingChoice {
  const funding = toFundingInputs(proposal)
  const finalTcp = computeFinalTcp({ funding, sow: proposal.projectJSON.data.sow })
  const deposit = resolveDeposit(funding.depositAmount, finalTcp)
  const financeable = canFinance(finalTcp, deposit)
  const storedCash = funding.cashInDeal
  const allCash = !financeable || isAllCash(storedCash, finalTcp)
  const cash = roundToCents(allCash ? finalTcp : clampFinancedCashDown(storedCash, finalTcp, deposit))
  return {
    finalTcp,
    deposit,
    canFinance: financeable,
    allCash,
    storedCash,
    cash,
    financed: roundToCents(Math.max(0, finalTcp - cash)),
    selectedOptionId: proposal.financeOptionId,
    schedule: computePaymentSchedule(finalTcp, deposit),
  }
}

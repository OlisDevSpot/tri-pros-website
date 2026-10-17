import type { PaymentScheduleRow } from '@/shared/modules/proposals/core/lib/financials'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { canFinance, clampFinancedCashDown, computeFinalTcp, computePaymentSchedule, isAllCash, resolveDeposit, roundToCents } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'

export type StoredFundingSource = Parameters<typeof toFundingInputs>[0] & {
  projectJSON: { data: { sow: SOW[] } }
  financeOptionId: number | null
}

/**
 * `saved`: the cash down exactly as stored, the way the agreement, the PDF and the summary print it; for a frozen
 * proposal. `editable`: the stored choice pulled inside today's bounds, the value the page would save; for an open one.
 */
export type StoredFundingView = 'saved' | 'editable'

export interface StoredFundingChoice {
  finalTcp: number
  deposit: number
  canFinance: boolean
  allCash: boolean
  /** The column as stored, which may sit outside the bounds on an old row. */
  storedCash: number
  /** The cash down for the view asked for, rounded to the cent. */
  cash: number
  financed: number
  selectedOptionId: number | null
  schedule: PaymentScheduleRow[]
}

// Rounded to the cent, so an editable value already inside the bounds equals `storedCash` and opening the page writes nothing.
export function deriveStoredFundingChoice(proposal: StoredFundingSource, view: StoredFundingView): StoredFundingChoice {
  const funding = toFundingInputs(proposal)
  const finalTcp = computeFinalTcp({ funding, sow: proposal.projectJSON.data.sow })
  const deposit = resolveDeposit(funding.depositAmount, finalTcp)
  const financeable = canFinance(finalTcp, deposit)
  const storedCash = funding.cashInDeal
  const allCash = view === 'saved' ? isAllCash(storedCash, finalTcp) : !financeable || isAllCash(storedCash, finalTcp)
  const cash = view === 'saved'
    ? roundToCents(storedCash)
    : roundToCents(allCash ? finalTcp : clampFinancedCashDown(storedCash, finalTcp, deposit))
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

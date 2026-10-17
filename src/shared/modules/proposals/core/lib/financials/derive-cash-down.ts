import { canFinance, clampFinancedCashDown, getDefaultCashDown, isAllCash, roundToCents } from './cash-down'

/** A meeting deal of mode `cash` stays all cash at any price; everything else starts at the deposit. */
export function deriveCreateCashDown({ finalTcp, deposit, meetingDealIsCash }: { finalTcp: number, deposit: number, meetingDealIsCash: boolean }): number {
  return roundToCents(meetingDealIsCash ? finalTcp : getDefaultCashDown(finalTcp, deposit))
}

/** The cash down is the homeowner's to choose; an edit moves it only when the new price or deposit puts it out of bounds. */
export function deriveEditCashDown({ storedCash, storedFinalTcp, nextFinalTcp, nextDeposit }: { storedCash: number, storedFinalTcp: number, nextFinalTcp: number, nextDeposit: number }): number {
  if (isAllCash(storedCash, storedFinalTcp) || !canFinance(nextFinalTcp, nextDeposit)) {
    return roundToCents(nextFinalTcp)
  }
  return roundToCents(clampFinancedCashDown(storedCash, nextFinalTcp, nextDeposit))
}

import type { StoredFundingChoice } from './derive-stored-funding-choice'

import { numberToUSD } from '@/shared/lib/formatters'
import { getLoanValues } from '@/shared/lib/loan-calculations'

import { pickMoneyFormat } from './money-format'

export interface ChoiceTile {
  label: string
  value: string
}

interface LoanTerm {
  termInMonths: number
  /** A fraction: 0.0999 is 9.99% APR. */
  interestRate: number
}

/** The homeowner's choice as four tiles; the first names the plan. `term` is the stored loan term, null when none is picked. */
export function deriveChoiceTiles(choice: StoredFundingChoice, term: LoanTerm | null): ChoiceTile[] {
  const format = pickMoneyFormat([choice.finalTcp, choice.deposit, choice.cash, choice.financed])
  if (choice.allCash) {
    return [
      { label: 'Plan', value: 'All cash' },
      { label: 'Price', value: format(choice.finalTcp) },
      { label: 'Deposit', value: format(choice.deposit) },
      { label: 'Then', value: `${choice.schedule.filter(row => row.due !== 'signing').length} payments` },
    ]
  }
  return [
    { label: 'Plan', value: 'Financed' },
    { label: 'Cash down', value: format(choice.cash) },
    { label: 'Term', value: term ? `${term.termInMonths / 12} years` : 'Not picked' },
    { label: 'Monthly', value: term ? numberToUSD(getLoanValues(choice.financed, term.interestRate, term.termInMonths).monthly) : '—' },
  ]
}

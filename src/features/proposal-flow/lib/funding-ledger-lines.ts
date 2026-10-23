import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionIncentives, computeTotalSectionPrices } from '@/shared/modules/proposals/core/lib/financials'
import { plural } from './form-parts'

export interface FundingLedgerLine {
  key: 'scopeOfWork' | 'misc' | 'subtotal' | 'tcp' | 'sectionIncentives' | 'incentives' | 'price'
  label: string
  amount: number
  sub?: string
  input?: 'miscPrice' | 'startingTcp'
  clamped?: boolean
}

type LedgerValues = Pick<ProposalFormSchema, 'funding'> & { sow: ProposalFormSchema['project']['data']['sow'] }

export function fundingLedgerLines(values: LedgerValues, mode: PriceDisplayMode): FundingLedgerLine[] {
  const { funding, sow } = values
  const sectionIncentives = computeTotalSectionIncentives(sow)
  const discounts = computeTotalDiscounts(funding)
  const clamped = funding.startingTcp - discounts - sectionIncentives < 0

  // `0 - n` rather than `-n` so a zero total never renders as −0.
  const incentivesLine: FundingLedgerLine = { key: 'incentives', label: 'Incentives', amount: 0 - discounts }
  const priceLine: FundingLedgerLine = {
    key: 'price',
    label: 'Price',
    amount: computeFinalTcp({ funding, sow }),
    ...(clamped && { clamped }),
  }

  if (mode === 'breakdown') {
    const scopeOfWork = computeTotalSectionPrices(sow) - sectionIncentives
    const misc = funding.miscPrice ?? 0
    return [
      { key: 'scopeOfWork', label: 'Scope of Work', amount: scopeOfWork, sub: `${plural(sow.length, 'section')} · final prices` },
      { key: 'misc', label: 'Misc Pricing', amount: misc, input: 'miscPrice' },
      { key: 'subtotal', label: 'Subtotal', amount: scopeOfWork + misc },
      incentivesLine,
      priceLine,
    ]
  }

  return [
    { key: 'tcp', label: 'Total Contract Price', amount: funding.startingTcp, input: 'startingTcp' },
    ...(sectionIncentives > 0
      ? [{ key: 'sectionIncentives', label: 'Section incentives', amount: 0 - sectionIncentives } satisfies FundingLedgerLine]
      : []),
    incentivesLine,
    priceLine,
  ]
}

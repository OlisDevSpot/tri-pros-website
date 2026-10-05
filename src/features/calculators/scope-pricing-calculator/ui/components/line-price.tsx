import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  result: QuoteLineResult | undefined
}

export function LinePrice({ result }: Props) {
  if (result == null) {
    return null
  }
  if (result.status === 'priced') {
    return <p className="shrink-0 text-lg font-semibold tabular-nums">{formatAsDollars(result.price)}</p>
  }
  const needs = result.needs.length > 0
    ? `Needs ${result.needs.map(key => VARIABLES[key].label.toLowerCase()).join(', ')}`
    : 'Needs a price'
  return <p className="max-w-48 shrink-0 text-right text-sm text-status-pending-fg">{needs}</p>
}

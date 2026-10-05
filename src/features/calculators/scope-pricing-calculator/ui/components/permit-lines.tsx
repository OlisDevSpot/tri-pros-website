import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  quote: QuoteResult
}

export function PermitLines({ quote }: Props) {
  const permits = quote.lines.filter(line => line.kind === 'permit' && line.status === 'priced')
  if (permits.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-1 px-1 text-sm">
      {permits.map(line => (
        <li className="flex justify-between" key={line.id}>
          <span>{line.label}</span>
          <span className="tabular-nums">{line.status === 'priced' ? formatAsDollars(line.price) : null}</span>
        </li>
      ))}
    </ul>
  )
}

import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'

interface Props {
  projection: RemodelRoiProjection
}

export function LoansNote({ projection }: Props) {
  const count = projection.liabilities.length
  if (!count) {
    return null
  }
  return (
    <p className="text-base">
      You also pay
      {' '}
      <b className="tabular-nums">{roundMoney(projection.liabilitiesMonthly)}</b>
      {' '}
      a month on
      {' '}
      {count === 1 ? 'your loan' : `${count} loans`}
      . That is the same on both paths.
    </p>
  )
}

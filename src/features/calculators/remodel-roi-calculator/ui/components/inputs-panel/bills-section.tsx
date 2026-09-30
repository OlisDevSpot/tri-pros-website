import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BillRow } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/bill-row'

interface Props {
  projection: RemodelRoiProjection
}

export function BillsSection({ projection }: Props) {
  return (
    <>
      <p className="text-xs leading-snug text-muted-foreground">Monthly averages. The cut comes from the trades you picked; switch to % or $ to type your own.</p>
      {BILL_CATEGORIES.map(category => <BillRow category={category} cut={projection.cuts[category]} key={category} />)}
    </>
  )
}

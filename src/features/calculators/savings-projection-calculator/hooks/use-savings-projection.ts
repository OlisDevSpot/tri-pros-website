import type { Control } from 'react-hook-form'
import type { SavingsProjectionConfig } from '@/features/calculators/savings-projection-calculator/schemas/config'
import type { SavingsProjectionFormValues } from '@/features/calculators/savings-projection-calculator/schemas/form'
import type { SavingsProjection } from '@/features/calculators/savings-projection-calculator/types'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { projectSavings } from '@/features/calculators/savings-projection-calculator/lib/project-savings'

export function useSavingsProjection(control: Control<SavingsProjectionFormValues>, config: SavingsProjectionConfig): SavingsProjection {
  const [homeValue, liabilities, billsNow, billsAfter, project, assumptions] = useWatch({
    control,
    name: ['homeValue', 'liabilities', 'billsNow', 'billsAfter', 'project', 'assumptions'],
  })

  return useMemo(
    () => projectSavings({ homeValue, liabilities, billsNow, billsAfter, project, assumptions }, config),
    [homeValue, liabilities, billsNow, billsAfter, project, assumptions, config],
  )
}

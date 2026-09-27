import type { Control } from 'react-hook-form'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'

export function useRemodelRoi(control: Control<RemodelRoiFormValues>, config: RemodelRoiConfig): RemodelRoiProjection {
  const [homeValue, liabilities, billsNow, billsAfter, project, assumptions] = useWatch({
    control,
    name: ['homeValue', 'liabilities', 'billsNow', 'billsAfter', 'project', 'assumptions'],
  })

  return useMemo(
    () => projectRemodelRoi({ homeValue, liabilities, billsNow, billsAfter, project, assumptions }, config),
    [homeValue, liabilities, billsNow, billsAfter, project, assumptions, config],
  )
}

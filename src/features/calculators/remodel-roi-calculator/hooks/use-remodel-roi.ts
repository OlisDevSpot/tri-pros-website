import type { Control } from 'react-hook-form'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useMemo, useState } from 'react'
import { useWatch } from 'react-hook-form'

import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { remodelRoiFormSchema } from '@/features/calculators/remodel-roi-calculator/schemas/form'

export function useRemodelRoi(control: Control<RemodelRoiFormValues>, config: RemodelRoiConfig): RemodelRoiProjection {
  const values = useWatch({ control })
  const parsed = useMemo(() => remodelRoiFormSchema.safeParse(values), [values])
  const [valid, setValid] = useState(() => remodelRoiFormSchema.parse(values))

  // A field mid-edit can be out of range; the story keeps the last valid numbers until it is fixed.
  if (parsed.success && parsed.data !== valid) {
    setValid(parsed.data)
  }

  return useMemo(() => projectRemodelRoi(valid, config), [valid, config])
}

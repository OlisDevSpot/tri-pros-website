import type { Control } from 'react-hook-form'
import type { NetWorthProjectionConfig } from '@/features/calculators/net-worth-projection-calculator/schemas/config'
import type { NetWorthProjectionFormValues } from '@/features/calculators/net-worth-projection-calculator/schemas/form'
import type { NetWorthProjection } from '@/features/calculators/net-worth-projection-calculator/types'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { projectNetWorth } from '@/features/calculators/net-worth-projection-calculator/lib/project-net-worth'

export function useNetWorthProjection(control: Control<NetWorthProjectionFormValues>, config: NetWorthProjectionConfig): NetWorthProjection {
  const [homeValue, liabilities, billsNow, billsAfter, project, assumptions] = useWatch({
    control,
    name: ['homeValue', 'liabilities', 'billsNow', 'billsAfter', 'project', 'assumptions'],
  })

  return useMemo(
    () => projectNetWorth({ homeValue, liabilities, billsNow, billsAfter, project, assumptions }, config),
    [homeValue, liabilities, billsNow, billsAfter, project, assumptions, config],
  )
}

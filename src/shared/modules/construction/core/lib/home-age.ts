import type { YearBuiltRange } from '@/shared/constants/enums/customers'

import { ERA_BUILD_YEAR, ERA_FALLBACK } from '@/shared/modules/construction/core/constants/era-defaults'

export function homeAge(yearBuilt: YearBuiltRange | null, year: number): number {
  return Math.max(0, year - ERA_BUILD_YEAR[yearBuilt ?? ERA_FALLBACK])
}

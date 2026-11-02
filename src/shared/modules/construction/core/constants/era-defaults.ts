import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { InsulationLevel } from '@/shared/modules/construction/core/constants/enums'

// With no year built, the drawing assumes the era most of the service area's housing stock comes from.
export const ERA_FALLBACK: YearBuiltRange = '1950-1978'

export const INSULATION_BY_ERA = {
  'Pre-1950': 'low',
  '1950-1978': 'low',
  '1978-1998': 'medium',
  '1998-2014': 'medium',
  'Post-2014': 'high',
} as const satisfies Record<YearBuiltRange, InsulationLevel>

// The year a typical home of each era was built, so a home's age grows with the calendar.
export const ERA_BUILD_YEAR = {
  'Pre-1950': 1945,
  '1950-1978': 1964,
  '1978-1998': 1988,
  '1998-2014': 2006,
  'Post-2014': 2019,
} as const satisfies Record<YearBuiltRange, number>

import type { VariableUnit } from '@/features/calculators/scope-pricing-calculator/types'

export const UNIT_SUFFIXES = {
  BSQ: 'BSQ',
  count: '',
  tons: 'tons',
  sqft: 'sq ft',
} as const satisfies Record<Exclude<VariableUnit, null>, string>

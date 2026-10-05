import type { SelectOption, SelectVariableDef } from '@/features/calculators/scope-pricing-calculator/types'

import { UNIT_SUFFIXES } from '@/features/calculators/scope-pricing-calculator/constants/variable-units'

export function formatVariableOption(def: SelectVariableDef, option: SelectOption): string {
  const named = def.optionLabels?.[String(option)]
  if (named) {
    return named
  }
  const suffix = def.unit ? UNIT_SUFFIXES[def.unit] : ''
  return suffix ? `${option} ${suffix}` : String(option)
}

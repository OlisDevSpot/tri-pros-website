import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { FormulaDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

export function defineFormula<const T extends PricingTrade, const Keys extends readonly VariableKey[]>(
  formula: FormulaDef<T, Keys>,
): FormulaDef<T, Keys> {
  return formula
}

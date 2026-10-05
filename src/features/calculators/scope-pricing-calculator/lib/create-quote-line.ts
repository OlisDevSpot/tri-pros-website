import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { FormulaLineValues, ManualLineValues, ScopePricingLineValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'

export function createFormulaLine(pricingKey: PricingKey): FormulaLineValues {
  const formula = FORMULAS[pricingKey]
  const variables: FormulaLineValues['variables'] = {}
  for (const key of formula.variables) {
    const def: VariableDef = VARIABLES[key]
    variables[key] = formula.defaults?.[key] ?? def.default ?? null
  }
  return { id: crypto.randomUUID(), kind: 'formula', pricingKey, variables }
}

export function createManualLine(): ManualLineValues {
  return { id: crypto.randomUUID(), kind: 'manual', label: '', price: null }
}

export function duplicateLine(line: ScopePricingLineValues): ScopePricingLineValues {
  return line.kind === 'formula'
    ? { ...line, id: crypto.randomUUID(), variables: { ...line.variables } }
    : { ...line, id: crypto.randomUUID() }
}

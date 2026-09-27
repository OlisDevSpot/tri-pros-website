import type { Formula, VariableDef, VariableInputs, VariableKey, VariableValues } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { buildFormulaVariablesSchema } from '@/features/calculators/scope-pricing-calculator/schemas/formula-variables'

export type ResolvedVariables
  = | { ok: true, values: VariableValues<readonly VariableKey[]> }
    | { ok: false, needs: VariableKey[] }

function isVariableKey(key: unknown): key is VariableKey {
  return typeof key === 'string' && key in VARIABLES
}

export function resolveFormulaVariables(formula: Formula, inputs: VariableInputs): ResolvedVariables {
  const merged: Record<string, unknown> = {}
  for (const key of formula.variables) {
    const def: VariableDef = VARIABLES[key]
    merged[key] = inputs[key] ?? formula.defaults?.[key] ?? def.default
  }
  const parsed = buildFormulaVariablesSchema(formula).safeParse(merged)
  if (parsed.success) {
    // The schema was built from this Formula's own Variable list, so the parsed shape is exactly that list.
    return { ok: true, values: parsed.data as VariableValues<readonly VariableKey[]> }
  }
  const needs = [...new Set(parsed.error.issues.map(issue => issue.path[0]))].filter(isVariableKey)
  return { ok: false, needs }
}

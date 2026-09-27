import type { Formula, VariableDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import { z } from 'zod'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'

function variableSchema(key: VariableKey) {
  const def: VariableDef = VARIABLES[key]
  if (def.kind === 'number') {
    return z.number().min(def.min).max(def.max)
  }
  if (def.kind === 'boolean') {
    return z.boolean()
  }
  const options = def.options
  return z.union([z.number(), z.string()]).refine(value => options.includes(value), { message: 'Not one of the options' })
}

export function buildFormulaVariablesSchema(formula: Formula) {
  return z.object(Object.fromEntries(formula.variables.map(key => [key, variableSchema(key)])))
}

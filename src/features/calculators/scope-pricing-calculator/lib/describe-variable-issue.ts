import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

export function describeVariableIssue(def: VariableDef, value: unknown): string {
  if (value == null) {
    return 'Required'
  }
  if (def.kind === 'number') {
    return `Enter ${def.min.toLocaleString('en-US')}–${def.max.toLocaleString('en-US')}`
  }
  return 'Choose an option'
}

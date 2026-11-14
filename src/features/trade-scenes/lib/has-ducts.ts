import type { ResolvedPart } from '@/shared/modules/construction/core/types'

// Every home resolves heating & cooling, so only the duct run itself says whether the home has ducts.
export function hasDucts(parts: readonly ResolvedPart[]): boolean {
  const runs = parts.find(part => part.id === 'duct-runs')
  return runs !== undefined && runs.material !== null && runs.condition !== 'absent'
}

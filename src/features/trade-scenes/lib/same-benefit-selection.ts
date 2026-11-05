import type { BenefitSelection } from '@/features/trade-scenes/types'

export function sameBenefitSelection(a: BenefitSelection | null, b: BenefitSelection | null): boolean {
  if (a === null || b === null) {
    return a === b
  }
  return a.type === b.type
    && ('system' in a ? 'system' in b && a.system === b.system : !('system' in b))
    && ('kind' in a ? 'kind' in b && a.kind === b.kind : !('kind' in b))
}

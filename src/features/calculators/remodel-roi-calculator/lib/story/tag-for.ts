import type { SourceTag } from '@/features/calculators/remodel-roi-calculator/types'
import type { ValueSource } from '@/shared/lib/resolve-overridable'

export function tagFor(source: ValueSource): SourceTag {
  return source === 'input' ? 'yours' : 'assumption'
}

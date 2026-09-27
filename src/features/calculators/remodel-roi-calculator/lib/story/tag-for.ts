import type { SourceTag, ValueSource } from '@/features/calculators/remodel-roi-calculator/types'

export function tagFor(source: ValueSource): SourceTag {
  return source === 'input' ? 'yours' : 'assumption'
}

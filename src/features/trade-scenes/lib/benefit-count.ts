import type { BenefitLine } from '@/features/trade-scenes/types'

import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

// A coming-soon line is no benefit yet, so it is not counted; lines that are all coming soon say so.
export function benefitCount(lines: readonly BenefitLine[]): string {
  const real = lines.filter(line => !line.soon).length
  if (real > 0) {
    return BENEFITS_COPY.matrix.count(real)
  }
  return lines.length > 0 ? BENEFITS_COPY.rail.soon : BENEFITS_COPY.matrix.none
}

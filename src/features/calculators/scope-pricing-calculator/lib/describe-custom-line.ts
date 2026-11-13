import type { FormulaConfig } from '@/features/calculators/scope-pricing-calculator/types'

// Exterior paint is the only Formula that returns null, so the copy is paint's; a second one moves the hint onto the Formula.
export function describeCustomLine(config: FormulaConfig): string {
  return `Over ${config.exteriorPaintHomeSizes.largeMaxSqFt.toLocaleString('en-US')} sq ft, enter a price`
}

import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installExteriorPaint = defineFormula({
  key: 'installExteriorPaint',
  trade: 'exteriorPaintSiding',
  label: 'Install exterior paint',
  outcome: 'Protect your home from weather while giving it a fresh, modern exterior look',
  variables: ['paintType', 'homeSqFt', 'garageSqFt'],
  compute({ paintType, homeSqFt, garageSqFt }, _context, costs, config) {
    const totalSqFt = homeSqFt + garageSqFt
    const { smallBelowSqFt, largeAboveSqFt } = config.exteriorPaintTiers
    if (paintType === 'coolLife') {
      if (totalSqFt < smallBelowSqFt) {
        return costs.coolLifePaintSm
      }
      return totalSqFt > largeAboveSqFt ? costs.coolLifePaintLarge : costs.coolLifePaintAvg
    }
    if (totalSqFt < smallBelowSqFt) {
      return costs.waterPaintSm
    }
    return totalSqFt > largeAboveSqFt ? costs.waterPaintLarge : costs.waterPaintAvg
  },
})

import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installExteriorPaint = defineFormula({
  key: 'installExteriorPaint',
  trade: 'exteriorPaintSiding',
  label: 'Install exterior paint',
  outcome: 'Protect your home from weather while giving it a fresh, modern exterior look',
  variables: ['paintType', 'homeSqFt', 'garageIncluded'],
  compute({ paintType, homeSqFt, garageIncluded }, context, costs, config) {
    const { smallMaxSqFt, averageMaxSqFt, largeMaxSqFt } = config.exteriorPaintHomeSizes
    if (homeSqFt > largeMaxSqFt) {
      return null
    }
    const [small, average, large] = paintType === 'coolLife'
      ? [costs.coolLifePaintSm, costs.coolLifePaintAvg, costs.coolLifePaintLarge]
      : [costs.waterPaintSm, costs.waterPaintAvg, costs.waterPaintLarge]
    let sizeCost = large
    if (homeSqFt <= smallMaxSqFt) {
      sizeCost = small
    }
    else if (homeSqFt <= averageMaxSqFt) {
      sizeCost = average
    }
    return sizeCost + (garageIncluded ? costs.garage : 0) + (context.numStories - 1) * costs.additionalStory
  },
})

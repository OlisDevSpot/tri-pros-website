import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const rnrAttic = defineFormula({
  key: 'rnrAttic',
  trade: 'atticBasement',
  label: 'Replace attic insulation',
  outcome: 'Improve comfort and cut energy waste with fresh, high-performance attic insulation',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtRnr
  },
})

export const topOffAttic = defineFormula({
  key: 'topOffAttic',
  trade: 'atticBasement',
  label: 'Top-off attic insulation',
  outcome: 'Boost home efficiency and comfort with a quick insulation upgrade',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtTopOff
  },
})

export const installCrawlSpaceInsulation = defineFormula({
  key: 'installCrawlSpaceInsulation',
  trade: 'atticBasement',
  label: 'Install crawl-space insulation',
  outcome: 'Reduce heat loss and moisture issues by insulating your raised-foundation home properly',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtCrawlSpace
  },
})

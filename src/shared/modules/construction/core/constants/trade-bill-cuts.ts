import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'

// The team's working numbers, not yet sourced: the share of each bill a trade cuts, in percent (25 = 25%).
export const TRADE_BILL_CUTS = {
  'hvac': { base: { electric: 25, gas: 20 }, addOns: { ducts: { electric: 5, gas: 5 } } },
  // Tri Pros sells cool roofs, so the roof's own cut is the cool covering's; a regular covering saves no energy.
  'roof-and-gutters': { base: { electric: 8 } },
  'windows-and-doors': { base: { electric: 10, gas: 8 } },
  'attic-and-basement': { base: { electric: 10, gas: 15 }, addOns: { 'radiant-barrier': { electric: 5, gas: 2 }, 'attic-fan': { electric: 4 } } },
  'foundation-and-crawl-space': { base: { electric: 2, gas: 5 } },
  'exterior-paint-stucco-and-siding': { base: { electric: 4 } },
  'dryscaping': { base: { water: 40, gardening: 50 } },
} as const satisfies TradeBillCuts

import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

import { BILL_GROWTH_RATES_PERCENT } from '@/shared/modules/construction/core/constants/bill-growth-rates'
import { CONSTRUCTION_GROWTH_RATE_PERCENT } from '@/shared/modules/construction/core/constants/construction-growth-rate'
import { REPAIRS_PER_YEAR } from '@/shared/modules/construction/core/constants/repairs-per-year'

export const REMODEL_ROI_CONFIG_DEFAULTS = {
  defaultLookAheadYears: 10,
  defaultRatesPercent: { ...BILL_GROWTH_RATES_PERCENT },
  defaultHomeAppreciationPercent: 4,
  defaultConstructionPercent: CONSTRUCTION_GROWTH_RATE_PERCENT,
  // The team's working share of the price a remodel adds to the home, until sourced per trade.
  defaultValueAddedPercent: 80,
  // Placeholder terms until the owner sets the house's default financing.
  defaultFinancing: { aprPercent: 8.99, termYears: 15 },
  // New-install lives and the current one's standard life and price are the team's working numbers, not yet sourced; new-install lives are the owner's (warranties run up to 25 years).
  trades: {
    'hvac': {
      newLifeYears: 25,
      current: { standardLifeYears: 18, likeForLikePrice: 16000, repairsPerYear: REPAIRS_PER_YEAR.hvac },
    },
    'roof-and-gutters': {
      newLifeYears: 25,
      current: { standardLifeYears: 25, likeForLikePrice: 28000, repairsPerYear: REPAIRS_PER_YEAR['roof-and-gutters'] },
    },
    'windows-and-doors': {
      newLifeYears: 25,
      current: { standardLifeYears: 25, likeForLikePrice: 15000, repairsPerYear: REPAIRS_PER_YEAR['windows-and-doors'] },
    },
    'attic-and-basement': {
      newLifeYears: null,
    },
    'exterior-paint-stucco-and-siding': {
      newLifeYears: 25,
      current: { standardLifeYears: 10, likeForLikePrice: 8000, repairsPerYear: REPAIRS_PER_YEAR['exterior-paint-stucco-and-siding'] },
    },
    'dryscaping': {
      newLifeYears: 25,
    },
  },
} satisfies Omit<RemodelRoiConfig, 'billCuts'>

import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

export const REMODEL_ROI_CONFIG_DEFAULTS = {
  defaultLookAheadYears: 10,
  // Carried over from the old calculator, which cited no source for these rates; they stay visible and editable on screen.
  defaultRatesPercent: { electric: 9.4, water: 10.3, gas: 13.1, gardening: 5, misc: 0 },
  defaultHomeAppreciationPercent: 4,
  // The team's working estimate until a sourced construction-cost index replaces it.
  defaultConstructionPercent: 5,
  // The team's working share of the price a remodel adds to the home, until sourced per trade.
  defaultValueAddedPercent: 80,
  // Placeholder terms until the owner sets the house's default financing.
  defaultFinancing: { aprPercent: 8.99, termYears: 15 },
  // Bill cuts, new-install lives and the current one's standard life, price and repairs are the team's working numbers, not yet sourced; new-install lives are the owner's (warranties run up to 25 years).
  trades: {
    hvac: {
      cutsPercent: { electric: 25, gas: 20 },
      ductsCutsPercent: { electric: 5, gas: 5 },
      newLifeYears: 25,
      current: { standardLifeYears: 18, likeForLikePrice: 16000, repairsPerYear: 600 },
    },
    roof: {
      cutsPercent: { electric: 8 },
      newLifeYears: 25,
      current: { standardLifeYears: 25, likeForLikePrice: 28000, repairsPerYear: 400 },
    },
    windowsAndDoors: {
      cutsPercent: { electric: 10, gas: 8 },
      newLifeYears: 25,
      current: { standardLifeYears: 25, likeForLikePrice: 15000, repairsPerYear: 200 },
    },
    atticBasement: {
      cutsPercent: { electric: 10, gas: 15 },
      newLifeYears: null,
    },
    exteriorPaintSiding: {
      cutsPercent: { electric: 4 },
      newLifeYears: 25,
      current: { standardLifeYears: 10, likeForLikePrice: 8000, repairsPerYear: 150 },
    },
    dryscapingHardscaping: {
      cutsPercent: { water: 40, gardening: 50 },
      newLifeYears: 25,
    },
  },
} satisfies RemodelRoiConfig

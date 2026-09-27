import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

export const SCOPE_PRICING_CONFIG_DEFAULTS = {
  unitCosts: {
    roof: {
      BSQTearOffFlat: 530,
      BSQTearOffShingles: 480,
      BSQTearOffTile: 750,
      BSQRedeckFlat: 650,
      BSQRedeckPitched: 700,
      BSQTileReset: 580,
      BSQOverlayPitched: 420,
      BSQOverlayFlat: 420,
      dollarPerAdditionalStory: 25,
      dollarPerAdditionalLayer: 25,
    },
    hvac: { threeTonRnr: 8500, furnace36kBTURnr: 7000, miniSplits: 3000, perTonStep: 800 },
    windowsAndDoors: { windowSmall: 550, windowLarge: 650, slidingDoorStandard: 2500, slidingDoorSpecial: 3000, frenchDoor: 5000 },
    atticBasement: { dollarPerSqFtTopOff: 1.3, dollarPerSqFtRnr: 2.5, dollarPerSqFtCrawlSpace: 2.3 },
    dryscapingHardscaping: {
      dollarPerSqFtArtificial: 7,
      dollarPerSqFtGravel: 6,
      dollarPerSqFtMulch: 5,
      dollarPerSqFtConcrete: 11,
      dollarPerSqFtPavers: 11,
      dollarPerSqFtDg: 5,
    },
    electricals: { mpuBase: 3200, mpuWithRelocation: 4000 },
    exteriorPaintSiding: {
      coolLifePaintSm: 6000,
      coolLifePaintAvg: 7000,
      coolLifePaintLarge: 8500,
      waterPaintSm: 4000,
      waterPaintAvg: 5000,
      waterPaintLarge: 6500,
    },
  },
  exteriorPaintTiers: { smallBelowSqFt: 1500, largeAboveSqFt: 3000 },
  permitFees: { roof: { amount: 250, enabled: false }, hvac: { amount: 250, enabled: false } },
  multiplier: { default: 2.8, floor: 2 },
  taxRatePercent: 7.5,
} satisfies ScopePricingConfig

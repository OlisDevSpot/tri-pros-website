import { z } from 'zod'

const unitCost = z.number().min(0)
const permitFee = z.object({ amount: z.number().min(0), enabled: z.boolean() })

export const scopePricingConfigSchema = z.object({
  unitCosts: z.object({
    roof: z.object({
      BSQTearOffFlat: unitCost,
      BSQTearOffShingles: unitCost,
      BSQTearOffTile: unitCost,
      BSQRedeckFlat: unitCost,
      BSQRedeckPitched: unitCost,
      BSQTileReset: unitCost,
      BSQOverlayPitched: unitCost,
      BSQOverlayFlat: unitCost,
      dollarPerAdditionalStory: unitCost,
      dollarPerAdditionalLayer: unitCost,
    }),
    solar: z.object({
      dollarPerWatt: unitCost,
      dollarPerPanelRnr: unitCost,
      battery5kWh: unitCost,
      battery10kWh: unitCost,
    }),
    hvac: z.object({
      threeTonRnr: unitCost,
      furnace36kBTURnr: unitCost,
      miniSplits: unitCost,
      perTonStep: unitCost,
    }),
    windowsAndDoors: z.object({
      windowSmall: unitCost,
      windowLarge: unitCost,
      slidingDoorStandard: unitCost,
      slidingDoorSpecial: unitCost,
      frenchDoor: unitCost,
    }),
    atticBasement: z.object({
      dollarPerSqFtTopOff: unitCost,
      dollarPerSqFtRnr: unitCost,
      dollarPerSqFtCrawlSpace: unitCost,
    }),
    dryscapingHardscaping: z.object({
      dollarPerSqFtArtificial: unitCost,
      dollarPerSqFtGravel: unitCost,
      dollarPerSqFtMulch: unitCost,
      dollarPerSqFtConcrete: unitCost,
      dollarPerSqFtPavers: unitCost,
      dollarPerSqFtDg: unitCost,
    }),
    electricals: z.object({
      mpuBase: unitCost,
      mpuWithRelocation: unitCost,
    }),
    exteriorPaintSiding: z.object({
      coolLifePaintSm: unitCost,
      coolLifePaintAvg: unitCost,
      coolLifePaintLarge: unitCost,
      waterPaintSm: unitCost,
      waterPaintAvg: unitCost,
      waterPaintLarge: unitCost,
    }),
  }),
  exteriorPaintTiers: z
    .object({ smallBelowSqFt: z.number().positive(), largeAboveSqFt: z.number().positive() })
    .refine(tiers => tiers.smallBelowSqFt < tiers.largeAboveSqFt, { message: 'The small-home threshold must be below the large-home threshold' }),
  permitFees: z.object({ roof: permitFee, hvac: permitFee }),
  multiplier: z
    .object({ default: z.number().positive(), floor: z.number().positive() })
    .refine(multiplier => multiplier.default >= multiplier.floor, { message: 'The default multiplier cannot be below the floor' }),
  taxRatePercent: z.number().min(0).max(20),
})

export type ScopePricingConfig = z.infer<typeof scopePricingConfigSchema>
export type PricingTrade = keyof ScopePricingConfig['unitCosts']
export type UnitCostsOf<T extends PricingTrade> = ScopePricingConfig['unitCosts'][T]
export type PermitTrade = keyof ScopePricingConfig['permitFees']

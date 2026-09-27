import { z } from 'zod'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { TERM_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import { LOOK_AHEAD_YEARS, PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'

export const ratePercentSchema = z.number().min(-20).max(50)
export const sharePercentSchema = z.number().min(0).max(100)

const cutsPercent = z.partialRecord(z.enum(BILL_CATEGORIES), sharePercentSchema)

const tradeConfig = z.object({
  cutsPercent,
  // null: lasts the life of the home.
  newLifeYears: z.number().int().min(PROJECTION_YEARS, 'A new install must outlast the longest look-ahead').nullable(),
})

const agingTradeConfig = tradeConfig.extend({
  current: z.object({
    standardLifeYears: z.number().int().min(1).max(80),
    likeForLikePrice: z.number().min(0),
    repairsPerYear: z.number().min(0),
  }),
})

export const remodelRoiConfigSchema = z.object({
  defaultLookAheadYears: z.literal(LOOK_AHEAD_YEARS),
  defaultRatesPercent: z.object({
    electric: ratePercentSchema,
    water: ratePercentSchema,
    gas: ratePercentSchema,
    gardening: ratePercentSchema,
    misc: ratePercentSchema,
  }),
  defaultHomeAppreciationPercent: ratePercentSchema,
  defaultConstructionPercent: ratePercentSchema,
  defaultValueAddedPercent: sharePercentSchema,
  defaultFinancing: z.object({ aprPercent: z.number().min(0).max(40), termYears: z.literal(TERM_YEARS) }),
  trades: z.object({
    hvac: agingTradeConfig.extend({ ductsCutsPercent: cutsPercent }),
    roof: agingTradeConfig,
    windowsAndDoors: agingTradeConfig,
    atticBasement: tradeConfig,
    exteriorPaintSiding: agingTradeConfig,
    dryscapingHardscaping: tradeConfig,
  }),
})

export type RemodelRoiConfig = z.infer<typeof remodelRoiConfigSchema>

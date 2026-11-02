import { z } from 'zod'

import { TERM_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import { LOOK_AHEAD_YEARS, PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { tradeBillCutsSchema } from '@/shared/modules/construction/core/schemas/bill-cuts'

export const ratePercentSchema = z.number().min(-20).max(50)
export const sharePercentSchema = z.number().min(0).max(100)

const tradeConfig = z.object({
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
    'hvac': agingTradeConfig,
    'roof-and-gutters': agingTradeConfig,
    'windows-and-doors': agingTradeConfig,
    'attic-and-basement': tradeConfig,
    'exterior-paint-stucco-and-siding': agingTradeConfig,
    'dryscaping': tradeConfig,
  }),
  billCuts: tradeBillCutsSchema,
})

export type RemodelRoiConfig = z.infer<typeof remodelRoiConfigSchema>

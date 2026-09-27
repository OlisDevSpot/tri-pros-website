import { z } from 'zod'

export const ratePercentSchema = z.number().min(-20).max(50)

export const remodelRoiConfigSchema = z.object({
  defaultHorizonYears: z.number().int().min(1).max(30),
  defaultRatesPercent: z.object({
    homeAppreciation: ratePercentSchema,
    electric: ratePercentSchema,
    gas: ratePercentSchema,
    water: ratePercentSchema,
    gardening: ratePercentSchema,
    misc: ratePercentSchema,
  }),
})

export type RemodelRoiConfig = z.infer<typeof remodelRoiConfigSchema>
export type RateKey = keyof RemodelRoiConfig['defaultRatesPercent']

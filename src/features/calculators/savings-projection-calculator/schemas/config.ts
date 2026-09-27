import { z } from 'zod'

const ratePercent = z.number().min(-20).max(50)

export const savingsProjectionConfigSchema = z.object({
  defaultHorizonYears: z.number().int().min(1).max(30),
  defaultRatesPercent: z.object({
    homeAppreciation: ratePercent,
    electric: ratePercent,
    gas: ratePercent,
    water: ratePercent,
    gardening: ratePercent,
    misc: ratePercent,
  }),
})

export type SavingsProjectionConfig = z.infer<typeof savingsProjectionConfigSchema>
export type RateKey = keyof SavingsProjectionConfig['defaultRatesPercent']

import { z } from 'zod'

import { UPLIFT_MODES } from '@/features/calculators/remodel-roi-calculator/constants/uplift-modes'
import { ratePercentSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'

const amount = z.number().min(0).nullable()
const aprPercent = z.number().min(0).max(40).nullable()
const ratePercent = ratePercentSchema.nullable()
const bills = z.object({ electric: amount, gas: amount, water: amount, gardening: amount, misc: amount })

export const remodelRoiFormSchema = z.object({
  homeValue: amount,
  liabilities: z.array(z.object({
    label: z.string().max(60),
    balance: amount,
    monthlyPayment: amount,
    aprPercent,
  })),
  billsNow: bills,
  billsAfter: bills,
  project: z.object({
    price: amount,
    incentives: amount,
    downPayment: amount,
    aprPercent,
    termMonths: z.number().int().min(0).max(480).nullable(),
    uplift: z.object({ mode: z.enum(UPLIFT_MODES), value: amount }),
  }),
  assumptions: z.object({
    horizonYears: z.number().int().min(1).max(30).nullable(),
    ratesPercent: z.object({
      homeAppreciation: ratePercent,
      electric: ratePercent,
      gas: ratePercent,
      water: ratePercent,
      gardening: ratePercent,
      misc: ratePercent,
    }),
  }),
})

export type RemodelRoiFormValues = z.infer<typeof remodelRoiFormSchema>

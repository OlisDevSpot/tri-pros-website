import { z } from 'zod'

import { CUT_MODES, LIABILITY_KINDS, PAYMENT_MODES, TERM_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import { ratePercentSchema, sharePercentSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'

const amount = z.number().min(0).nullable()
const aprPercent = z.number().min(0).max(40).nullable()
const ratePercent = ratePercentSchema.nullable()
const bill = z.object({ now: amount, cut: z.object({ mode: z.enum(CUT_MODES), value: amount }) })
const current = z.object({ ageYears: z.number().min(0).max(100).nullable(), likeForLikePrice: amount, repairsPerYear: amount })

export const remodelRoiFormSchema = z.object({
  trades: z.object({
    hvac: z.object({ ducts: z.boolean(), current }).nullable(),
    roof: z.object({ current }).nullable(),
    windowsAndDoors: z.object({ current }).nullable(),
    atticBasement: z.object({}).nullable(),
    exteriorPaintSiding: z.object({ current }).nullable(),
    dryscapingHardscaping: z.object({}).nullable(),
  }),
  bills: z.object({ electric: bill, water: bill, gas: bill, gardening: bill, misc: bill }),
  project: z.object({
    price: amount,
    incentives: amount,
    downPayment: amount,
    paymentMode: z.enum(PAYMENT_MODES),
    aprPercent,
    termYears: z.literal(TERM_YEARS),
  }),
  homeValue: amount,
  liabilities: z.array(z.object({
    label: z.string().max(60),
    balance: amount,
    monthlyPayment: amount,
    aprPercent,
    kind: z.enum(LIABILITY_KINDS),
  })),
  assumptions: z.object({
    ratesPercent: z.object({ electric: ratePercent, water: ratePercent, gas: ratePercent, gardening: ratePercent, misc: ratePercent }),
    constructionPercent: ratePercent,
    homeAppreciationPercent: ratePercent,
    valueAddedPercent: sharePercentSchema.nullable(),
  }),
})

export type RemodelRoiFormValues = z.infer<typeof remodelRoiFormSchema>

import { z } from 'zod'

import { PRICING_KEYS } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import { CURRENT_ROOF_TYPES } from '@/features/calculators/scope-pricing-calculator/constants/project-context'

// Stories and roof type are typed in by the rep until they can be prefilled from the customer's profile.
export const projectContextSchema = z.object({
  numStories: z.number().int().min(1).max(4),
  currentRoofType: z.enum(CURRENT_ROOF_TYPES),
})

export type ProjectContext = z.infer<typeof projectContextSchema>

const variableInputValue = z.union([z.number(), z.string(), z.boolean()]).nullable()

const formulaLineSchema = z.object({
  id: z.string(),
  kind: z.literal('formula'),
  pricingKey: z.enum(PRICING_KEYS),
  variables: z.record(z.string(), variableInputValue),
})

const manualLineSchema = z.object({
  id: z.string(),
  kind: z.literal('manual'),
  label: z.string().max(80),
  price: z.number().min(0).nullable(),
})

export function createScopePricingFormSchema(multiplierFloor: number) {
  return z.object({
    context: projectContextSchema,
    lines: z.array(z.discriminatedUnion('kind', [formulaLineSchema, manualLineSchema])),
    agent: z.object({
      multiplier: z.number().min(multiplierFloor, { message: `The multiplier can't go below ${multiplierFloor}` }).nullable(),
      targetPrice: z.number().min(0).nullable(),
    }),
  })
}

export type ScopePricingFormValues = z.infer<ReturnType<typeof createScopePricingFormSchema>>
export type ScopePricingLineValues = ScopePricingFormValues['lines'][number]
export type FormulaLineValues = Extract<ScopePricingLineValues, { kind: 'formula' }>
export type ManualLineValues = Extract<ScopePricingLineValues, { kind: 'manual' }>

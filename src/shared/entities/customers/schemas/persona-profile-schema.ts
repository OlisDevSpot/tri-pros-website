import { z } from 'zod'

export const personaFearSchema = z.object({
  fear: z.string(),
  source: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  emotionalDriver: z.string(),
})

export const personaBenefitSchema = z.object({
  headline: z.string(),
  body: z.string(),
  tradeName: z.string(),
  category: z.string(),
})

export const personaDecisionDriverSchema = z.object({
  driver: z.string(),
  signal: z.string(),
  weight: z.enum(['strong', 'moderate', 'weak']),
})

export const personaEmotionalLeverSchema = z.object({
  lever: z.string(),
  relevance: z.enum(['primary', 'secondary']),
  context: z.string(),
})

export const personaHouseholdResonanceSchema = z.object({
  factor: z.string(),
  amplifiedConcerns: z.array(z.string()),
})

export const personaRiskFactorSchema = z.object({
  risk: z.string(),
  mitigation: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
})

export const customerPersonaProfileSchema = z.object({
  fears: z.array(personaFearSchema),
  benefits: z.array(personaBenefitSchema),
  decisionDrivers: z.array(personaDecisionDriverSchema),
  emotionalLevers: z.array(personaEmotionalLeverSchema),
  householdResonance: z.array(personaHouseholdResonanceSchema),
  riskFactors: z.array(personaRiskFactorSchema),
})

export type PersonaFear = z.infer<typeof personaFearSchema>
export type PersonaBenefit = z.infer<typeof personaBenefitSchema>
export type PersonaDecisionDriver = z.infer<typeof personaDecisionDriverSchema>
export type PersonaEmotionalLever = z.infer<typeof personaEmotionalLeverSchema>
export type PersonaHouseholdResonance = z.infer<typeof personaHouseholdResonanceSchema>
export type PersonaRiskFactor = z.infer<typeof personaRiskFactorSchema>
export type CustomerPersonaProfile = z.infer<typeof customerPersonaProfileSchema>

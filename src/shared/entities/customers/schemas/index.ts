import z from 'zod'
import {
  creditScoreRanges,
  customerAgeGroups,
  decisionTimelines,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'
import {
  foundationTypes,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  roofTypes,
  windowsTypes,
} from '@/shared/domains/construction/constants/enums'

// HELPER SCHEMA
export const painSchema = z.object({
  accessor: z.string(),
  urgencyRating: z.number().int().min(1).max(10),
})

export const customerProfileSchema = z.object({
  triggerEvent: z.enum(triggerEvents),
  mainPainPoint: painSchema,
  additionalPainPoints: z.array(painSchema),
  outcomePriority: z.enum(outcomePriorities),
  timeInHome: z.enum(yearsInHomeRanges),
  householdType: z.enum(householdTypes),
  priorContractorExperience: z.enum(priorContractorExperiences),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
  sellPlan: z.enum(sellPlans),
  decisionTimeline: z.enum(decisionTimelines),
  projectNecessityRating: z.number().int().min(1).max(10),
  ageGroup: z.enum(customerAgeGroups),
  age: z.number().int().min(18).max(120),
}).partial()

export const propertyProfileSchema = z.object({
  hoa: z.boolean().default(false).optional(),
  yearBuilt: z.enum(yearBuiltRanges),
  roofType: z.enum(roofTypes),
  foundationType: z.enum(foundationTypes),
  hvacType: z.enum(hvacTypes),
  hvacComponents: z.enum(hvacComponents),
  windowsType: z.enum(windowsTypes),
  insulationLevel: z.enum(insulationLevels),
}).partial()

export const financialProfileSchema = z.object({
  numQuotesReceived: z.number().int().min(0),
  creditScore: z.enum(creditScoreRanges),
}).partial()

export type CustomerProfile = z.infer<typeof customerProfileSchema>
export type PropertyProfile = z.infer<typeof propertyProfileSchema>
export type FinancialProfile = z.infer<typeof financialProfileSchema>

export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(),
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),
})
export type LeadMeta = z.infer<typeof leadMetaSchema>

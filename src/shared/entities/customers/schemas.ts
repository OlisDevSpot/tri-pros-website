import z from 'zod'
import {
  meetingCreditScoreRanges,
  meetingDecisionTimelines,
  meetingHouseholdTypes,
  meetingOutcomePriorities,
  meetingPriorContractorExperience,
  meetingSellPlans,
  meetingTriggerEvents,
  meetingYearBuiltRanges,
  meetingYearsInHome,
} from '@/shared/constants/enums'

// HELPER SCHEMA
export const painSchema = z.object({
  accessor: z.string(),
  urgencyRating: z.number().int().min(1).max(10),
})

export const customerProfileSchema = z.object({
  triggerEvent: z.enum(meetingTriggerEvents),
  mainPainPoint: painSchema,
  additionalPainPoints: z.array(painSchema),
  outcomePriority: z.enum(meetingOutcomePriorities),
  timeInHome: z.enum(meetingYearsInHome),
  householdType: z.enum(meetingHouseholdTypes),
  priorContractorExperience: z.enum(meetingPriorContractorExperience),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
  sellPlan: z.enum(meetingSellPlans),
  decisionTimeline: z.enum(meetingDecisionTimelines),
  projectNecessityRating: z.number().int().min(1).max(10),
  age: z.number().int().min(18).max(120),
}).partial()

export const propertyProfileSchema = z.object({
  hoa: z.boolean().default(false).optional(),
  yearBuilt: z.enum(meetingYearBuiltRanges),
}).partial()

export const financialProfileSchema = z.object({
  numQuotesReceived: z.number().int().min(0),
  creditScore: z.enum(meetingCreditScoreRanges),
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

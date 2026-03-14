import z from 'zod'
import {
  meetingAgeGroups,
  meetingCreditScoreRanges,
  meetingDecisionTimelines,
  meetingDecisionUrgencies,
  meetingFamilyStatuses,
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
  age: z.number().int().nonnegative(),
  triggerEvent: z.enum(meetingTriggerEvents),
  mainPainPoint: painSchema,
  additionalPainPoints: z.array(painSchema),
  outcomePriority: z.enum(meetingOutcomePriorities),
  timeInHome: z.enum(meetingYearsInHome),
  ageGroup: z.enum(meetingAgeGroups),
  householdType: z.enum(meetingHouseholdTypes).optional(),
  familyStatus: z.enum(meetingFamilyStatuses),
  priorContractorExperience: z.enum(meetingPriorContractorExperience),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
  sellPlan: z.enum(meetingSellPlans),
  decisionTimeline: z.enum(meetingDecisionTimelines),
  decisionUrgencyRating: z.enum(meetingDecisionUrgencies),
  projectNecessityRating: z.number().int().min(1).max(10),
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

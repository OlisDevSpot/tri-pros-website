import z, { boolean } from 'zod'
import {
  meetingAgeGroups,
  meetingCreditScoreRanges,
  meetingDecisionMakersPresentOptions,
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

// ── Base Profile (household demographics + pain + motivation + context) ───────
export const situationObjectiveProfileSchema = z.object({
  ageGroup: z.enum(meetingAgeGroups),
  householdType: z.enum(meetingHouseholdTypes).optional(),
  familyStatus: z.enum(meetingFamilyStatuses),
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  timeInHome: z.enum(meetingYearsInHome),
}).partial()

export const homeownerSubjectiveProfileSchema = z.object({
  triggerEvent: z.enum(meetingTriggerEvents),
  mainPain: painSchema,
  secondaryPain: painSchema,
  priorContractorExperience: z.enum(meetingPriorContractorExperience),
  outcomePriority: z.enum(meetingOutcomePriorities),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
  sellPlan: z.enum(meetingSellPlans),
  decisionTimeline: z.enum(meetingDecisionTimelines),
  decisionUrgencyRating: z.enum(meetingDecisionUrgencies),
  projectNecessityRating: z.number().int().min(1).max(10),
}).partial()

export const propertyProfileSchema = z.object({
  hoa: boolean().default(false).optional(),
  yearBuilt: z.enum(meetingYearBuiltRanges),
}).partial()

export const financialProfileSchema = z.object({
  numQuotesReceived: z.number().int().min(0),
  creditScore: z.enum(meetingCreditScoreRanges),
}).partial()

// ── Program-step collected data (scope, timeline, etc.) ───────────────────────
export const programDataSchema = z.object({
  scope: z.string(),
  bill: z.string(),
  timeline: z.enum(meetingDecisionTimelines),
  yrs: z.enum(meetingYearsInHome),
}).partial()

export const meetingBaseSchema = z.object({
  notionContactId: z.string().optional(),
  situationObjectiveProfile: situationObjectiveProfileSchema,
  homeownerSubjectiveProfile: homeownerSubjectiveProfileSchema,
  propertyProfile: propertyProfileSchema,
  financialProfile: financialProfileSchema,
})

export type SituationObjectiveProfile = z.infer<typeof situationObjectiveProfileSchema>
export type HomeownerSubjectiveProfile = z.infer<typeof homeownerSubjectiveProfileSchema>
export type PropertyProfile = z.infer<typeof propertyProfileSchema>
export type FinancialProfile = z.infer<typeof financialProfileSchema>
export type ProgramData = z.infer<typeof programDataSchema>
export type MeetingBaseProfile = z.infer<typeof meetingBaseSchema>

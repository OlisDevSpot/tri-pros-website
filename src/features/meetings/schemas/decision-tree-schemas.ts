import z from 'zod'
import { creditScoreRanges, decisionUrgencyStatuses, dmsAgeGroupOpts, dmsFamilyStatuses, dmsPresentStatuses, painType, planningToSellOpts, timeInHomeOpts, yearBuilt } from '../constants/decision-tree-variables'

export const meetingBaseProfileSchema = z.object({
  dmsPresentStatuses: z.enum(dmsPresentStatuses),
  familyStatuses: z.enum(dmsFamilyStatuses),
  ageGroup: z.enum(dmsAgeGroupOpts),
  timeInHome: z.enum(timeInHomeOpts),
  planningToSell: z.enum(planningToSellOpts),
  mainPain: z.enum(painType),
  secondaryPain: z.enum(painType),
  numQuotesReceived: z.number().int().min(0),
}).partial()

export const homeownerConstructionOutlookSchema = z.object({
  decisionUrgencyRating: z.enum(decisionUrgencyStatuses),
  projectNecessityRating: z.number().int().min(1).max(10),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
})

export const homeProfileSchema = z.object({
  yearBuilt: z.enum(yearBuilt),
  HOA: z.enum(['yes', 'no', 'N/A']),
}).partial()

export const financialProfileSchema = z.object({
  creditScore: z.enum(creditScoreRanges),
}).partial()

export const meetingsDecisionTreeSchema = z.object({
  meetingBaseProfile: meetingBaseProfileSchema,
  homeProfile: homeProfileSchema,
  financialProfile: financialProfileSchema,
})

export type MeetingBaseProfile = z.infer<typeof meetingBaseProfileSchema>
export type HomeProfile = z.infer<typeof homeProfileSchema>
export type FinancialProfile = z.infer<typeof financialProfileSchema>
export type MeetingsDecisionTree = z.infer<typeof meetingsDecisionTreeSchema>

export const baseDefaultValues: MeetingsDecisionTree = {
  meetingBaseProfile: {},
  homeProfile: {},
  financialProfile: {},
}

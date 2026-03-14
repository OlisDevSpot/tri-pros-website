import z from 'zod'
import {
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingTypes,
  meetingYearsInHome,
} from '@/shared/constants/enums'

export const situationProfileSchema = z.object({
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  meetingType: z.enum(meetingTypes),
}).partial()

export const programDataSchema = z.object({
  scope: z.string(),
  bill: z.string(),
  timeline: z.enum(meetingDecisionTimelines),
  yrs: z.enum(meetingYearsInHome),
}).partial()

export type SituationProfile = z.infer<typeof situationProfileSchema>
export type ProgramData = z.infer<typeof programDataSchema>

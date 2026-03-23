import z from 'zod'
import {
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingTypes,
  meetingYearsInHome,
} from '@/shared/constants/enums'

export const situationProfileSchema = z.object({
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  meetingType: z.enum(meetingTypes).catch(undefined as unknown as 'Fresh'),
}).partial()

export const programDataSchema = z.object({
  scope: z.string(),
  bill: z.string(),
  timeline: z.enum(meetingDecisionTimelines),
  yrs: z.enum(meetingYearsInHome),
}).partial()

export type SituationProfile = z.infer<typeof situationProfileSchema>
export type ProgramData = z.infer<typeof programDataSchema>

// Meeting scopes — JSONB on meetings table
export const meetingScopeEntrySchema = z.object({
  trade: z.object({ id: z.string(), label: z.string() }),
  scopes: z.array(z.object({ id: z.string(), label: z.string() })),
})
export type MeetingScopeEntry = z.infer<typeof meetingScopeEntrySchema>

export const meetingScopesSchema = z.array(meetingScopeEntrySchema)
export type MeetingScopes = z.infer<typeof meetingScopesSchema>

import type {
  meetingAgeGroups,
  meetingCreditScoreRanges,
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingDecisionUrgencies,
  meetingDmsPresentStatuses,
  meetingFamilyStatuses,
  meetingHouseholdTypes,
  meetingOutcomePriorities,
  meetingPainTypes,
  meetingPriorContractorExperience,
  meetingSellPlans,
  meetingStatuses,
  meetingTriggerEvents,
  meetingYearBuiltRanges,
  meetingYearsInHome,
} from '@/shared/constants/enums/meetings'

export type MeetingStatus = (typeof meetingStatuses)[number]
export type MeetingDecisionMakersPresentOption = (typeof meetingDecisionMakersPresentOptions)[number]
export type MeetingHouseholdType = (typeof meetingHouseholdTypes)[number]
export type MeetingOutcomePriority = (typeof meetingOutcomePriorities)[number]
export type MeetingTriggerEvent = (typeof meetingTriggerEvents)[number]
export type MeetingPriorContractor = (typeof meetingPriorContractorExperience)[number]
export type MeetingSellPlan = (typeof meetingSellPlans)[number]
export type MeetingYearBuiltRange = (typeof meetingYearBuiltRanges)[number]
export type MeetingTimeline = (typeof meetingDecisionTimelines)[number]
export type MeetingYearsInHome = (typeof meetingYearsInHome)[number]
export type MeetingDmsPresentStatus = (typeof meetingDmsPresentStatuses)[number]
export type MeetingFamilyStatus = (typeof meetingFamilyStatuses)[number]
export type MeetingAgeGroup = (typeof meetingAgeGroups)[number]
export type MeetingPainType = (typeof meetingPainTypes)[number]
export type MeetingDecisionUrgency = (typeof meetingDecisionUrgencies)[number]
export type MeetingCreditScoreRange = (typeof meetingCreditScoreRanges)[number]

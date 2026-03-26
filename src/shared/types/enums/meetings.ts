import type {
  customerDemeanors,
  energyEfficientTradeAccessors,
  meetingCreditScoreRanges,
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingDmsPresentStatuses,
  meetingHouseholdTypes,
  meetingOutcomePriorities,
  meetingOutcomes,
  meetingPainTypes,
  meetingPipelineStages,
  meetingPriorContractorExperience,
  meetingSellPlans,
  meetingStatuses,
  meetingTriggerEvents,
  meetingTypes,
  meetingYearBuiltRanges,
  meetingYearsInHome,
  observedBudgetComforts,
  spouseDynamics,
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
export type MeetingPainType = (typeof meetingPainTypes)[number]
export type MeetingCreditScoreRange = (typeof meetingCreditScoreRanges)[number]
export type MeetingPipelineStage = (typeof meetingPipelineStages)[number]
export type MeetingType = (typeof meetingTypes)[number]
export type MeetingOutcome = (typeof meetingOutcomes)[number]
export type ObservedBudgetComfort = (typeof observedBudgetComforts)[number]
export type SpouseDynamic = (typeof spouseDynamics)[number]
export type CustomerDemeanor = (typeof customerDemeanors)[number]
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]

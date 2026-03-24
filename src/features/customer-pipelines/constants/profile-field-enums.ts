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

export const CUSTOMER_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  ageGroup: meetingAgeGroups,
  decisionTimeline: meetingDecisionTimelines,
  decisionUrgencyRating: meetingDecisionUrgencies,
  familyStatus: meetingFamilyStatuses,
  householdType: meetingHouseholdTypes,
  outcomePriority: meetingOutcomePriorities,
  priorContractorExperience: meetingPriorContractorExperience,
  sellPlan: meetingSellPlans,
  timeInHome: meetingYearsInHome,
  triggerEvent: meetingTriggerEvents,
}

export const PROPERTY_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  yearBuilt: meetingYearBuiltRanges,
}

export const FINANCIAL_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  creditScore: meetingCreditScoreRanges,
}

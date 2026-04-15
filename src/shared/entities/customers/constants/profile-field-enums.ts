import {
  creditScoreRanges,
  decisionTimelines,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'

export const CUSTOMER_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  decisionTimeline: decisionTimelines,
  householdType: householdTypes,
  outcomePriority: outcomePriorities,
  priorContractorExperience: priorContractorExperiences,
  sellPlan: sellPlans,
  timeInHome: yearsInHomeRanges,
  triggerEvent: triggerEvents,
}

export const PROPERTY_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  yearBuilt: yearBuiltRanges,
}

export const FINANCIAL_PROFILE_ENUM_OPTIONS: Record<string, readonly string[]> = {
  creditScore: creditScoreRanges,
}

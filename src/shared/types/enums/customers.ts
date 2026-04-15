import type {
  budgetComforts,
  creditScoreRanges,
  customerAgeGroups,
  decisionTimelines,
  demeanors,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  spouseDynamics,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'

export type CustomerAgeGroup = (typeof customerAgeGroups)[number]
export type HouseholdType = (typeof householdTypes)[number]
export type PriorContractorExperience = (typeof priorContractorExperiences)[number]
export type SellPlan = (typeof sellPlans)[number]
export type YearsInHomeRange = (typeof yearsInHomeRanges)[number]
export type OutcomePriority = (typeof outcomePriorities)[number]
export type TriggerEvent = (typeof triggerEvents)[number]
export type DecisionTimeline = (typeof decisionTimelines)[number]
export type YearBuiltRange = (typeof yearBuiltRanges)[number]
export type CreditScoreRange = (typeof creditScoreRanges)[number]
export type BudgetComfort = (typeof budgetComforts)[number]
export type SpouseDynamic = (typeof spouseDynamics)[number]
export type Demeanor = (typeof demeanors)[number]

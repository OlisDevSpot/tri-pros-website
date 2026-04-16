import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import {
  customerAgeGroups,
  decisionTimelines,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'

export const CUSTOMER_PROFILE_FIELDS: ProfileFieldConfig[] = [
  { id: 'ageGroup', label: 'Age Group', type: 'select', options: customerAgeGroups },
  { id: 'triggerEvent', label: 'Trigger Event', type: 'select', options: triggerEvents },
  { id: 'outcomePriority', label: 'Outcome Priority', type: 'select', options: outcomePriorities },
  { id: 'householdType', label: 'Household Type', type: 'select', options: householdTypes },
  { id: 'timeInHome', label: 'Time in Home', type: 'select', options: yearsInHomeRanges },
  { id: 'sellPlan', label: 'Plan to Sell', type: 'select', options: sellPlans },
  { id: 'priorContractorExperience', label: 'Prior Contractor Experience', type: 'select', options: priorContractorExperiences },
  { id: 'decisionTimeline', label: 'Decision Timeline', type: 'select', options: decisionTimelines },
  { id: 'projectNecessityRating', label: 'Project Necessity (1-10)', type: 'number', min: 1, max: 10 },
  { id: 'constructionOutlookFavorabilityRating', label: 'Construction Outlook (1-10)', type: 'number', min: 1, max: 10 },
]

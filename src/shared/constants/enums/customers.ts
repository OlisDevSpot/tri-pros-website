export const customerAgeGroups = ['under-25', '25-45', '45-65', '65-75', '75-or-older'] as const
export type CustomerAgeGroup = (typeof customerAgeGroups)[number]

export const electricProviders = ['ladwp', 'edison', 'glendale water & power', 'burbank water & power', 'riverside public utilities', 'pg&e', 'other'] as const
export type ElectricProvider = (typeof electricProviders)[number]

// Customer profile options
export const householdTypes = [
  'Single man',
  'Single woman',
  'Couple',
  'Family',
  'Relatives',
] as const
export type HouseholdType = (typeof householdTypes)[number]

export const priorContractorExperiences = [
  'No',
  'Yes - good experience',
  'Yes - poor quality',
  'Yes - incomplete job',
  'Yes - no license',
] as const
export type PriorContractorExperience = (typeof priorContractorExperiences)[number]

export const sellPlans = ['No', 'Yes', 'Soon', 'Not sure'] as const
export type SellPlan = (typeof sellPlans)[number]

export const yearsInHomeRanges = ['< 3 years', '3–5 years', '5–10 years', '10–15 years', '> 15 years'] as const
export type YearsInHomeRange = (typeof yearsInHomeRanges)[number]

export const outcomePriorities = ['Price', 'Quality', 'Speed'] as const
export type OutcomePriority = (typeof outcomePriorities)[number]

export const triggerEvents = [
  'Damage or leak',
  'Maintenance',
  'High bill',
  'Neighbor\'s project',
  'Selling soon',
  'Other',
] as const
export type TriggerEvent = (typeof triggerEvents)[number]

export const decisionTimelines = ['ASAP', '1–3 months', '3–6 months', '6+ months', 'Not sure'] as const
export type DecisionTimeline = (typeof decisionTimelines)[number]

// Property profile options
export const yearBuiltRanges = [
  'Pre-1950',
  '1950-1978',
  '1978-1998',
  '1998-2014',
  'Post-2014',
] as const
export type YearBuiltRange = (typeof yearBuiltRanges)[number]

// Financial profile options
export const creditScoreRanges = ['600 or less', '600 – 700', '700+'] as const
export type CreditScoreRange = (typeof creditScoreRanges)[number]

// Customer observation options (observed during meetings, describe the customer)
export const budgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export type BudgetComfort = (typeof budgetComforts)[number]

export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export type SpouseDynamic = (typeof spouseDynamics)[number]

export const demeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const
export type Demeanor = (typeof demeanors)[number]

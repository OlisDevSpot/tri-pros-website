export const customerAgeGroups = ['under-65', '65-or-older'] as const

// Customer profile options
export const householdTypes = [
  'Single man',
  'Single woman',
  'Couple',
  'Family',
  'Senior(s)',
  'Empty nester(s)',
  'Multi-gen home',
] as const
export const priorContractorExperiences = [
  'No',
  'Yes - good experience',
  'Yes - poor quality',
  'Yes - incomplete job',
  'Yes - no license',
] as const
export const sellPlans = ['No', 'Yes', 'Soon', 'Not sure'] as const
export const yearsInHomeRanges = ['< 3 years', '3–5 years', '5–10 years', '10–15 years', '> 15 years'] as const
export const outcomePriorities = ['Price', 'Quality', 'Speed'] as const
export const triggerEvents = [
  'Damage or leak',
  'Maintenance',
  'High bill',
  'Neighbor\'s project',
  'Selling soon',
  'Other',
] as const
export const decisionTimelines = ['ASAP', '1–3 months', '3–6 months', '6+ months', 'Not sure'] as const

// Property profile options
export const yearBuiltRanges = [
  'Pre-1950',
  '1950-1978',
  '1978-1998',
  '1998-2014',
  'Post-2014',
] as const

// Financial profile options
export const creditScoreRanges = ['600 or less', '600 – 700', '700+'] as const

// Customer observation options (observed during meetings, describe the customer)
export const budgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export const demeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const

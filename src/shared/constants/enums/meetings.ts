export const meetingStatuses = ['in_progress', 'completed', 'converted'] as const

// Setup fields (DB-backed)
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash'] as const
export const meetingDecisionMakersPresentOptions = [
  'All present',
  'Partially present (only wife)',
  'Partially present (only husband)',
  'Partially present (missing family member)',
  'None present',
] as const
export const meetingAgeGroups = ['Young (18-25)', 'Young Adult (25-40)', 'Adult (40-62)', 'Senior (62-78)', 'Elder (78+)'] as const
export const meetingFamilyStatuses = ['Single man', 'Single woman', 'Couple', 'Family', 'Multi-family'] as const
export const meetingHouseholdTypes = ['Senior(s)', 'Empty nester(s)', 'Family', 'Non-senior(s)', 'Multi-gen home', 'Other'] as const
export const meetingOutcomePriorities = ['Price', 'Quality', 'Speed'] as const
export const meetingTriggerEvents = ['Neighbor\'s project', 'Damage or leak', 'Scheduled maintenance', 'High bill', 'Selling soon', 'Other'] as const
export const meetingPainPoints = [] as const
export const meetingPriorContractorExperience = ['No', 'Yes - good experience', 'Yes - poor quality', 'Yes - incomplete job', 'Yes - no license'] as const
export const meetingSellPlans = ['No', 'Yes', 'Soon', 'Not sure'] as const
export const meetingYearBuiltRanges = ['Pre-1950', '1950-1978', '1978-2014', 'Post-2014'] as const

// Program step collected fields (DB-backed)
export const meetingDecisionTimelines = ['ASAP', '1–3 months', '3–6 months', '6+ months', 'Not sure'] as const
export const meetingYearsInHome = ['< 3 years', '3–5 years', '5–10 years', '10–15 years', '> 15 years'] as const

// Decision-tree / intake form fields (DB-backed)
export const meetingDmsPresentStatuses = ['All present', 'Only husband present', 'Only wife present', 'None present'] as const
export const framingTypes = ['Car Payment Comparison', 'Payments Not Price', 'Rent vs Own', 'Price Justification'] as const
export const meetingPainTypes = [
  'Has urgent fixes',
  'Home has physical damages',
  'High maintenance / utility costs',
  'Home has inefficiencies',
  'Very old home',
  'Had bad past experience',
  'Fearful of construction',
  'Doesn\'t trust themselves with decision',
  'Has financial / budget constraints',
  'Social (competition / status / family)',
  'Home is not place of rest / comfort',
] as const
export const meetingDecisionUrgencies = ['ASAP', '1–2 weeks', '1 month', '3+ months'] as const
export const meetingCreditScoreRanges = ['< 600', '600–630', '630–650', '650–700', '700–749', '750–800', '> 800'] as const

// Pipeline stages (customer journey — meeting phase)
export const meetingPipelineStages = [
  'needs_confirmation',
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const

// Meeting outcomes (replaces meetingStatuses for the meeting flow)
export const meetingOutcomes = [
  'in_progress',
  'proposal_created',
  'follow_up_needed',
  'not_interested',
  'no_show',
] as const

// Agent observation enums (context panel)
export const observedBudgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export const customerDemeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const

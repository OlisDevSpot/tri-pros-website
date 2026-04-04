// Setup fields (DB-backed)
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash'] as const
export const meetingDecisionMakersPresentOptions = [
  'All present',
  'Partially present (only wife)',
  'Partially present (only husband)',
  'Partially present (missing family member)',
  'None present',
] as const
export const meetingHouseholdTypes = [
  'Single man',
  'Single woman',
  'Couple',
  'Family',
  'Senior(s)',
  'Empty nester(s)',
  'Multi-gen home',
] as const
export const meetingOutcomePriorities = ['Price', 'Quality', 'Speed'] as const
export const meetingTriggerEvents = [
  'Neighbor\'s project',
  'Damage or leak',
  'Scheduled maintenance',
  'High bill',
  'Selling soon',
  'Other',
] as const
export const meetingPriorContractorExperience = [
  'No',
  'Yes - good experience',
  'Yes - poor quality',
  'Yes - incomplete job',
  'Yes - no license',
] as const
export const meetingSellPlans = ['No', 'Yes', 'Soon', 'Not sure'] as const
export const meetingYearBuiltRanges = [
  'Pre-1950',
  '1950-1978',
  '1978-1998',
  '1998-2014',
  'Post-2014',
] as const

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
export const meetingCreditScoreRanges = ['600 or less', '600 – 700', '700+'] as const

// Pipeline stages (customer journey — meeting phase)
export const meetingPipelineStages = [
  'needs_confirmation',
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const

// Meeting outcomes (replaces meetingStatuses for the meeting flow)
// Green = good (revenue), Yellow = neutral, Red = bad (lost), Grey = unknown
export const meetingOutcomes = [
  'not_set',
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
  'follow_up_needed',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
  'not_interested', // deprecated — kept for DB backward compat, hidden from UI
] as const

/** Outcomes agents can manually select in dropdowns. */
export const selectableMeetingOutcomes = [
  'not_set',
  'follow_up_needed',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
] as const

/** Derived outcomes — set automatically, visible but disabled in dropdowns. */
export const derivedMeetingOutcomes = [
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
] as const

/** All outcomes shown in dropdowns (selectable + derived). Excludes deprecated. */
export const visibleMeetingOutcomes = [
  ...selectableMeetingOutcomes,
  ...derivedMeetingOutcomes,
] as const

// Agent observation enums (context panel)
export const observedBudgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export const customerDemeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const

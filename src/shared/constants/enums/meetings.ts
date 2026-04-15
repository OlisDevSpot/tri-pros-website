// Setup fields (DB-backed)
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash', 'Project'] as const

/** Meeting types shown in the create meeting form. Follow-up and Rehash are outcomes, not creation types. */
export const creatableMeetingTypes = ['Fresh', 'Project'] as const
export const meetingDecisionMakersPresentOptions = [
  'All present',
  'Partially present (only wife)',
  'Partially present (only husband)',
  'Partially present (missing family member)',
  'None present',
] as const

// Decision-tree / intake form fields (DB-backed)
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

export const selectableMeetingOutcomes = [
  'not_set',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
  'follow_up_needed',
] as const

/** Derived outcomes — set automatically, visible but disabled in dropdowns. */
export const derivedMeetingOutcomes = [
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
] as const

// Meeting outcomes (replaces meetingStatuses for the meeting flow)
// Green = good (revenue), Yellow = neutral, Red = bad (lost), Grey = unknown
export const meetingOutcomes = [
  ...selectableMeetingOutcomes,
  ...derivedMeetingOutcomes,
  'not_interested', // deprecated — kept for DB backward compat, hidden from UI
] as const

/** All outcomes shown in dropdowns (selectable + derived). Excludes deprecated. */
export const visibleMeetingOutcomes = [
  ...selectableMeetingOutcomes,
  ...derivedMeetingOutcomes,
] as const

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const

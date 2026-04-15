// Setup fields (DB-backed)
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash', 'Project'] as const
export type MeetingType = (typeof meetingTypes)[number]

/** Meeting types shown in the create meeting form. Follow-up and Rehash are outcomes, not creation types. */
export const creatableMeetingTypes = ['Fresh', 'Project'] as const
export type CreatableMeetingType = (typeof creatableMeetingTypes)[number]

export const meetingDecisionMakersPresentOptions = [
  'All present',
  'Partially present (only wife)',
  'Partially present (only husband)',
  'Partially present (missing family member)',
  'None present',
] as const
export type MeetingDecisionMakersPresent = (typeof meetingDecisionMakersPresentOptions)[number]

// Decision-tree / intake form fields (DB-backed)
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
export type MeetingPainType = (typeof meetingPainTypes)[number]

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
export type SelectableMeetingOutcome = (typeof selectableMeetingOutcomes)[number]

/** Derived outcomes — set automatically, visible but disabled in dropdowns. */
export const derivedMeetingOutcomes = [
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
] as const
export type DerivedMeetingOutcome = (typeof derivedMeetingOutcomes)[number]

// Meeting outcomes — composite of selectable + derived
// Green = good (revenue), Yellow = neutral, Red = bad (lost), Grey = unknown
export const meetingOutcomes = [
  ...selectableMeetingOutcomes,
  ...derivedMeetingOutcomes,
] as const
export type MeetingOutcome = (typeof meetingOutcomes)[number]

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]

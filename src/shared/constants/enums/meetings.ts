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

// Order drives the dropdown: unset first, then the neutral follow-up, then the
// negatives as one contiguous block (so no neutral sits among the reds).
export const selectableMeetingOutcomes = [
  'not_set',
  'follow_up_needed',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
  'cancelled',
  'nra',
] as const
export type SelectableMeetingOutcome = (typeof selectableMeetingOutcomes)[number]

/** Derived outcomes — set automatically, visible but disabled in dropdowns. */
export const derivedMeetingOutcomes = [
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
  'additional_work',
] as const
export type DerivedMeetingOutcome = (typeof derivedMeetingOutcomes)[number]

// Meeting outcomes — composite of selectable + derived
// Green = good (revenue), Yellow = neutral, Red = bad (lost), Grey = unknown
export const meetingOutcomes = [
  ...selectableMeetingOutcomes,
  ...derivedMeetingOutcomes,
] as const
export type MeetingOutcome = (typeof meetingOutcomes)[number]

export type MeetingOutcomeSentiment = 'positive' | 'neutral' | 'negative' | 'unset'

/**
 * THE canonical classifier for a meeting outcome's sentiment. Every color map,
 * stat bucket, and negative/positive branch in the app derives from this — do
 * not re-encode outcome sentiment anywhere else.
 *
 * - unset:    no decision recorded yet (not_set). Never colored like a neutral
 *             result; never requires a reason.
 * - neutral:  a real, in-progress / non-terminal result (follow-up, proposal
 *             created/sent). Each keeps its own distinct hue.
 * - positive: revenue outcome (new project or additional work).
 * - negative: lost / failed meeting.
 */
export const MEETING_OUTCOME_SENTIMENT: Record<MeetingOutcome, MeetingOutcomeSentiment> = {
  not_set: 'unset',
  follow_up_needed: 'neutral',
  proposal_created: 'neutral',
  proposal_sent: 'neutral',
  converted_to_project: 'positive',
  additional_work: 'positive',
  not_good: 'negative',
  pns: 'negative',
  npns: 'negative',
  ftd: 'negative',
  no_show: 'negative',
  lost_to_competitor: 'negative',
  cancelled: 'negative',
  nra: 'negative',
}

export function isNegativeOutcome(outcome: MeetingOutcome): boolean {
  return MEETING_OUTCOME_SENTIMENT[outcome] === 'negative'
}

/**
 * An agent must document a reason (stored as a customer note) whenever they set
 * a non-positive, decided outcome. That is every negative outcome plus
 * follow_up_needed. not_set (unset) and the positive outcomes never require one.
 */
export function outcomeRequiresReason(outcome: MeetingOutcome): boolean {
  return isNegativeOutcome(outcome) || outcome === 'follow_up_needed'
}

/** Outcomes that flag a meeting as needing agent attention (action queue). */
export const ATTENTION_OUTCOMES: MeetingOutcome[] = meetingOutcomes.filter(outcomeRequiresReason)

/** Outcomes that represent a decided/terminal state (anything but not_set). */
export const DECIDED_OUTCOMES: MeetingOutcome[] = meetingOutcomes.filter(o => o !== 'not_set')

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]

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

// Order drives the dropdown: unset first, then the negatives as one contiguous
// block, then the neutral follow-up — which sits right before the derived
// neutrals (proposal_created/sent), so all neutrals group together and no
// neutral ever falls among the reds.
export const selectableMeetingOutcomes = [
  'not_set',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
  'cancelled',
  'nra',
  'follow_up_needed',
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

/**
 * THE single source of truth for what a meeting outcome MEANS. Each outcome is
 * classified exactly once, at the finest grain the domain needs — the common
 * refinement of the two axes every consumer cares about:
 *   • sentiment (color / stats / reason-gating): unset · neutral · positive · negative
 *   • pipeline consequence of a negative: recallable (→ rehash) vs terminal (→ dead)
 *
 * Everything else — `MEETING_OUTCOME_SENTIMENT`, the recallable/terminal/positive
 * sets, `OUTCOME_PIPELINE_MAP` — DERIVES from this map, so they can never drift
 * and no runtime partition guard is needed. Because it's `Record<MeetingOutcome, …>`,
 * adding an outcome is a compile error until it is classified here, once.
 * Abbrev meanings: memory/reference-meeting-outcome-abbreviations.md.
 */
export type MeetingOutcomeClass = 'unset' | 'neutral' | 'positive' | 'negative-recallable' | 'negative-terminal'

export const MEETING_OUTCOME_CLASS: Record<MeetingOutcome, MeetingOutcomeClass> = {
  not_set: 'unset',
  follow_up_needed: 'neutral',
  proposal_created: 'neutral',
  proposal_sent: 'neutral',
  converted_to_project: 'positive',
  additional_work: 'positive',
  cancelled: 'negative-recallable',
  no_show: 'negative-recallable',
  pns: 'negative-recallable',
  npns: 'negative-recallable',
  nra: 'negative-recallable',
  lost_to_competitor: 'negative-terminal',
  not_good: 'negative-terminal',
  ftd: 'negative-terminal',
}

/** The outcomes whose class is one of the given classes. The one way to slice the SoT. */
function outcomesOfClass(...classes: readonly MeetingOutcomeClass[]): MeetingOutcome[] {
  return meetingOutcomes.filter(o => classes.includes(MEETING_OUTCOME_CLASS[o]))
}

// ── Derived views of the outcome taxonomy (never hand-authored) ──────────────

export type MeetingOutcomeSentiment = 'positive' | 'neutral' | 'negative' | 'unset'

/** Coarsen the class to the 4-value sentiment axis (both negative kinds → negative). */
function classToSentiment(c: MeetingOutcomeClass): MeetingOutcomeSentiment {
  return c === 'negative-recallable' || c === 'negative-terminal' ? 'negative' : c
}

/**
 * Outcome → sentiment (color maps, stat buckets, reason-gating). Derived from
 * `MEETING_OUTCOME_CLASS`; same shape/values as before. (`Object.fromEntries`
 * widens the key type, so re-assert the `Record` — the values are exhaustive by
 * construction over `meetingOutcomes`.)
 */
export const MEETING_OUTCOME_SENTIMENT = Object.fromEntries(
  meetingOutcomes.map(o => [o, classToSentiment(MEETING_OUTCOME_CLASS[o])]),
) as Record<MeetingOutcome, MeetingOutcomeSentiment>

export function isNegativeOutcome(outcome: MeetingOutcome): boolean {
  return MEETING_OUTCOME_SENTIMENT[outcome] === 'negative'
}

/**
 * Pipeline-relevant outcome sets, sliced from the SoT. `negative-recallable` →
 * a customer's `rehash` bucket; `negative-terminal` → `dead`; `positive` →
 * `projects`. Consumed by `derived-pipeline-sql.ts` and `outcome-pipeline-map.ts`.
 */
export const RECALLABLE_OUTCOMES: MeetingOutcome[] = outcomesOfClass('negative-recallable')
export const TERMINAL_OUTCOMES: MeetingOutcome[] = outcomesOfClass('negative-terminal')
export const POSITIVE_OUTCOMES: MeetingOutcome[] = outcomesOfClass('positive')

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

/** Outcomes that keep a meeting "live" — everything except the two that mean it never happened. */
export const LIVE_MEETING_OUTCOMES: MeetingOutcome[]
  = meetingOutcomes.filter(o => o !== 'cancelled' && o !== 'no_show')

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]

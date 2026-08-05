import type { MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

/**
 * One className per sentiment — colour is a pure function of sentiment, so
 * every outcome with the same disposition looks identical (no per-outcome
 * hues). The keys are exactly the `MeetingOutcomeSentiment` union.
 */
type OutcomeColorScheme = Record<'positive' | 'negative' | 'neutral' | 'unset', string>

/**
 * Builds a complete outcome→className map by indexing the scheme with each
 * outcome's sentiment. Because sentiment values map 1:1 to scheme keys, this
 * is exhaustive by construction, and returning Record<MeetingOutcome,string>
 * makes a missing outcome a compile error.
 */
function buildOutcomeColorMap(scheme: OutcomeColorScheme): Record<MeetingOutcome, string> {
  return Object.fromEntries(
    meetingOutcomes.map(outcome => [outcome, scheme[MEETING_OUTCOME_SENTIMENT[outcome]]]),
  ) as Record<MeetingOutcome, string>
}

// Profile modal badge colors (used with Badge variant="outline")
export const MEETING_LIST_STATUS_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500/10 text-red-600',
  positive: 'bg-green-500/10 text-green-600',
  neutral: 'bg-amber-500/10 text-amber-600',
  unset: 'bg-zinc-500/10 text-zinc-600',
})

// Table badge colors (used with StatusDropdownCell default Badge)
export const MEETING_OUTCOME_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-red-500/30 bg-red-500/10 text-red-400',
  positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  neutral: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  unset: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
})

// Dot colors for status indicators and sub-menu option indicators
export const MEETING_OUTCOME_DOT_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500',
  positive: 'bg-emerald-500',
  neutral: 'bg-amber-500',
  unset: 'bg-zinc-500',
})

// Human-readable labels for display
export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  not_set: 'Not Set',
  converted_to_project: 'Converted to Project',
  additional_work: 'Additional Work',
  proposal_sent: 'Proposal Sent',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  not_good: 'Not Good',
  pns: 'PNS',
  npns: 'NPNS',
  ftd: 'FTD',
  no_show: 'No Show',
  lost_to_competitor: 'Lost to Competitor',
  cancelled: 'Cancelled',
  nra: 'NRA',
}

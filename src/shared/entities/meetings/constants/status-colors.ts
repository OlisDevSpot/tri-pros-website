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

// Outcome badge colors — read the status tones (Task 5), which are
// theme-aware by construction, so the label clears contrast in BOTH light
// and dark with no per-mode variants.
export const MEETING_LIST_STATUS_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-status-danger-dot/40 bg-status-danger-bg text-status-danger-fg',
  positive: 'border-status-success-dot/40 bg-status-success-bg text-status-success-fg',
  neutral: 'border-status-pending-dot/40 bg-status-pending-bg text-status-pending-fg',
  unset: 'border-border bg-muted text-muted-foreground',
})

// Table badge colors (used with StatusDropdownCell default Badge) — same
// status-tone treatment so table badges read in dark mode too.
export const MEETING_OUTCOME_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-status-danger-dot/40 bg-status-danger-bg text-status-danger-fg',
  positive: 'border-status-success-dot/40 bg-status-success-bg text-status-success-fg',
  neutral: 'border-status-pending-dot/40 bg-status-pending-bg text-status-pending-fg',
  unset: 'border-border bg-muted text-muted-foreground',
})

// Dot colors for status indicators and sub-menu option indicators
export const MEETING_OUTCOME_DOT_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-status-danger-dot',
  positive: 'bg-status-success-dot',
  neutral: 'bg-status-pending-dot',
  unset: 'bg-status-idle-dot',
})

// Human-readable labels for display
export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  not_set: 'Not Set',
  converted_to_project: 'Converted to Project',
  additional_work: 'Additional Work',
  proposal_sent: 'Proposal Sent',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  reschedule_needed: 'Reschedule Needed',
  not_good: 'Not Good',
  pns: 'PNS',
  npns: 'NPNS',
  ftd: 'FTD',
  no_show: 'No Show',
  lost_to_competitor: 'Lost to Competitor',
  cancelled: 'Cancelled',
  nra: 'NRA',
}

import type { MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

interface OutcomeColorScheme {
  positive: string
  negative: string
  unset: string
  /** Neutral outcomes each keep a distinct hue, so they are specified per-outcome. */
  neutralByOutcome: Record<'follow_up_needed' | 'proposal_created' | 'proposal_sent', string>
}

/**
 * Builds a complete outcome→className map from a sentiment scheme. Negative,
 * positive, and unset colors come straight from MEETING_OUTCOME_SENTIMENT;
 * neutrals are named individually because they are intentionally different hues.
 * Returning Record<MeetingOutcome,string> makes a missing outcome a compile error.
 */
function buildOutcomeColorMap(scheme: OutcomeColorScheme): Record<MeetingOutcome, string> {
  return Object.fromEntries(
    meetingOutcomes.map((outcome) => {
      const sentiment = MEETING_OUTCOME_SENTIMENT[outcome]
      const color
        = sentiment === 'negative'
          ? scheme.negative
          : sentiment === 'positive'
            ? scheme.positive
            : sentiment === 'unset'
              ? scheme.unset
              : scheme.neutralByOutcome[outcome as keyof OutcomeColorScheme['neutralByOutcome']]
      return [outcome, color]
    }),
  ) as Record<MeetingOutcome, string>
}

// Profile modal badge colors (used with Badge variant="outline")
export const MEETING_LIST_STATUS_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500/10 text-red-600',
  positive: 'bg-green-500/10 text-green-600',
  unset: 'bg-zinc-500/10 text-zinc-600',
  neutralByOutcome: {
    follow_up_needed: 'bg-purple-500/10 text-purple-600',
    proposal_created: 'bg-amber-500/10 text-amber-600',
    proposal_sent: 'bg-lime-500/10 text-lime-600',
  },
})

// Table badge colors (used with StatusDropdownCell default Badge)
export const MEETING_OUTCOME_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-red-500/30 bg-red-500/10 text-red-400',
  positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  unset: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  neutralByOutcome: {
    follow_up_needed: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    proposal_created: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    proposal_sent: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
  },
})

// Dot colors for status indicators and sub-menu option indicators
export const MEETING_OUTCOME_DOT_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500',
  positive: 'bg-emerald-500',
  unset: 'bg-zinc-500',
  neutralByOutcome: {
    follow_up_needed: 'bg-purple-500',
    proposal_created: 'bg-amber-500',
    proposal_sent: 'bg-lime-500',
  },
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

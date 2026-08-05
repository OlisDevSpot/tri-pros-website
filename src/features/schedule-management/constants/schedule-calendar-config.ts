import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

export const DEFAULT_HIDDEN_DAYS = [6] // Saturday

// One tint per sentiment — same disposition, same calendar tint (no per-outcome hues).
const CALENDAR_TINT_BY_SENTIMENT: Record<'positive' | 'negative' | 'neutral' | 'unset', string> = {
  negative: 'bg-red-500/5 border-red-500/20',
  positive: 'bg-emerald-500/5 border-emerald-500/20',
  neutral: 'bg-amber-500/5 border-amber-500/20',
  unset: 'bg-zinc-500/5 border-zinc-500/20',
}

export const STATUS_BG_TINTS: Record<MeetingOutcome, string> = Object.fromEntries(
  meetingOutcomes.map(outcome => [outcome, CALENDAR_TINT_BY_SENTIMENT[MEETING_OUTCOME_SENTIMENT[outcome]]]),
) as Record<MeetingOutcome, string>

export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-blue-500/5 border-blue-500/20',
  reminder: 'bg-amber-500/5 border-amber-500/20',
  task: 'bg-emerald-500/5 border-emerald-500/20',
  event: 'bg-purple-500/5 border-purple-500/20',
}

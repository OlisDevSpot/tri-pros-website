import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

export const DEFAULT_HIDDEN_DAYS = [6] // Saturday

// One accent color per sentiment, rendered as a solid left bar on a real
// (bg-card) surface — so the card reads as a distinct, categorized surface in
// BOTH themes. Built on theme-aware semantic tokens. (The old 5%-opacity full
// wash over a transparent column was effectively invisible.)
const CALENDAR_ACCENT_BY_SENTIMENT: Record<'positive' | 'negative' | 'neutral' | 'unset', string> = {
  negative: 'bg-destructive',
  positive: 'bg-success',
  neutral: 'bg-warning',
  unset: 'bg-muted-foreground/40',
}

export const STATUS_ACCENT_COLORS: Record<MeetingOutcome, string> = Object.fromEntries(
  meetingOutcomes.map(outcome => [outcome, CALENDAR_ACCENT_BY_SENTIMENT[MEETING_OUTCOME_SENTIMENT[outcome]]]),
) as Record<MeetingOutcome, string>

export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-blue-500/5 border-blue-500/20',
  reminder: 'bg-amber-500/5 border-amber-500/20',
  task: 'bg-emerald-500/5 border-emerald-500/20',
  event: 'bg-purple-500/5 border-purple-500/20',
}

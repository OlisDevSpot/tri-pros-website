import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

export const DEFAULT_HIDDEN_DAYS = [6] // Saturday

// A loading day draws a believable day's load rather than the same block everywhere.
export const SKELETON_EVENTS_PER_DAY = { min: 1, max: 4 } as const

// Day-view skeleton cards stay in buckets that end by 5 PM: the evening bucket sits off-screen
// at common widths, and a one-lane day with its card there would look empty while loading.
export const SKELETON_BUSINESS_HOURS_END_HOUR = 17

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
  note: 'bg-status-info-bg/60 border-status-info-dot/30',
  reminder: 'bg-status-pending-bg/60 border-status-pending-dot/30',
  task: 'bg-status-success-bg/60 border-status-success-dot/30',
  event: 'bg-status-action-bg/60 border-status-action-dot/30',
}

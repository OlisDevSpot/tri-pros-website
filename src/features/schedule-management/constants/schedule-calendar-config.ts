import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'
import { MEETING_OUTCOME_SENTIMENT, meetingOutcomes } from '@/shared/constants/enums/meetings'

export const DEFAULT_HIDDEN_DAYS = [6] // Saturday

const CALENDAR_TINT_BY_SENTIMENT = {
  negative: 'bg-red-500/5 border-red-500/20',
  positive: 'bg-emerald-500/5 border-emerald-500/20',
  unset: 'bg-zinc-500/5 border-zinc-500/20',
} as const

const CALENDAR_TINT_NEUTRAL: Record<'follow_up_needed' | 'proposal_created' | 'proposal_sent', string> = {
  follow_up_needed: 'bg-purple-500/5 border-purple-500/20',
  proposal_created: 'bg-amber-500/5 border-amber-500/20',
  proposal_sent: 'bg-lime-500/5 border-lime-500/20',
}

export const STATUS_BG_TINTS: Record<MeetingOutcome, string> = Object.fromEntries(
  meetingOutcomes.map((outcome) => {
    const sentiment = MEETING_OUTCOME_SENTIMENT[outcome]
    const tint
      = sentiment === 'neutral'
        ? CALENDAR_TINT_NEUTRAL[outcome as keyof typeof CALENDAR_TINT_NEUTRAL]
        : CALENDAR_TINT_BY_SENTIMENT[sentiment]
    return [outcome, tint]
  }),
) as Record<MeetingOutcome, string>

export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-blue-500/5 border-blue-500/20',
  reminder: 'bg-amber-500/5 border-amber-500/20',
  task: 'bg-emerald-500/5 border-emerald-500/20',
  event: 'bg-purple-500/5 border-purple-500/20',
}

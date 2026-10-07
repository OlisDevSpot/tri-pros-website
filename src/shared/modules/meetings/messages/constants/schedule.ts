import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

/** Pacific wall-clock send times. The cron expressions are built from this, so what a screen shows is what runs. */
export const VISIT_MESSAGE_SCHEDULE = {
  // A summary sent after `summaryCutoffHour` the day before makes the 6 PM reminder a repeat.
  day_before_reminder: { hour: 18, minute: 0, daysBefore: 1, summaryCutoffHour: 12 },
  // A "good morning" text 30 minutes before the visit is noise, so earlier visits get none.
  rep_confirmation: { hour: 8, minute: 30, daysBefore: 0, earliestVisitHour: 9 },
} as const satisfies Record<PausableVisitMessageKind, {
  hour: number
  minute: number
  daysBefore: number
  summaryCutoffHour?: number
  earliestVisitHour?: number
}>

export const VISIT_MESSAGE_LATE_AFTER_MS = 15 * 60 * 1000
export const VISIT_MESSAGE_PENDING_STALE_MS = 10 * 60 * 1000
/** QStash can deliver a moment early; anything earlier than this is not today's run. */
export const VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS = 5 * 60 * 1000

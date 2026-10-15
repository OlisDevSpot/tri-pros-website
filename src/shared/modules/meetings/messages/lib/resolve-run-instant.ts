import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { businessDateTime, businessDayKey, businessHour } from '@/shared/lib/business-time'
import {
  VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS,
  VISIT_MESSAGE_SCHEDULE,
  VISIT_MESSAGE_SEND_CEILING_HOUR,
} from '@/shared/modules/meetings/messages/constants/schedule'

/**
 * The instant a run evaluates the plan at, or null when this delivery is not today's run.
 * A delivery a moment early still counts as the scheduled time, so a due step is not seen as scheduled and missed.
 * A retry that lands after midnight is hours before the new day's run and gets null, so it cannot send a day early.
 * A retry that lands late in the evening gets null too, so nobody is texted at night.
 */
export function resolveRunInstant(kind: PausableVisitMessageKind, now: Date): Date | null {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  const scheduled = businessDateTime(businessDayKey(now), hour, minute)
  if (now.getTime() < scheduled.getTime() - VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS) {
    return null
  }
  const instant = new Date(Math.max(now.getTime(), scheduled.getTime()))
  if (businessHour(instant) >= VISIT_MESSAGE_SEND_CEILING_HOUR) {
    return null
  }
  return instant
}

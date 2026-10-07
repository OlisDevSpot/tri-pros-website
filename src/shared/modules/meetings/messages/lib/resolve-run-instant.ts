import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { businessDateTime, businessDayKey } from '@/shared/lib/business-time'
import { VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS, VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'

/**
 * The instant a run evaluates the plan at, or null when this delivery is not today's run.
 * A delivery a moment early still counts as the scheduled time, so a due step is not seen as scheduled and missed.
 * A retry that lands after midnight is hours before the new day's run and gets null, so it cannot send a day early.
 */
export function resolveRunInstant(kind: PausableVisitMessageKind, now: Date): Date | null {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  const scheduled = businessDateTime(businessDayKey(now), hour, minute)
  if (now.getTime() < scheduled.getTime() - VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS) {
    return null
  }
  return new Date(Math.max(now.getTime(), scheduled.getTime()))
}

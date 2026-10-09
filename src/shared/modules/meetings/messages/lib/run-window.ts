import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { addCalendarDays, businessDayKey, businessDayWindow } from '@/shared/lib/business-time'
import { VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'

/** The meetings a run looks at: the business day its kind describes, counted from the run's own day. */
export function runWindowFor(kind: PausableVisitMessageKind, runAt: Date): { day: string, from: string, to: string } {
  const day = addCalendarDays(businessDayKey(runAt), VISIT_MESSAGE_SCHEDULE[kind].daysBefore)
  return { day, ...businessDayWindow(day) }
}

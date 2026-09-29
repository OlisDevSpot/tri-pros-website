// `meetingWindow('today')` runs both server-side (RSC prefetch in Vercel's UTC
// runtime) and in the agent's browser. Deriving "today" from ambient local time
// would give server and client different query keys near the UTC/PT offset and
// a hydration mismatch, so every boundary comes from the business timezone.

import { addCalendarDays, businessDayWindow, businessMonthWindow, businessToday, toInclusiveRange } from '@/shared/lib/business-time'

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** LA-pinned inclusive bounds of the calendar month, for the meetings scheduledFor filter. */
export function meetingMonthWindow(anchorCalendarDay: string): { from: string, to: string } {
  return toInclusiveRange(businessMonthWindow(anchorCalendarDay.slice(0, 7)))
}

/** Inclusive bounds for the meetings `scheduledFor` dateRange filter, business-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const today = businessToday()
  switch (kind) {
    case 'today':
      return toInclusiveRange(businessDayWindow(today))
    case 'upcoming':
      return { from: businessDayWindow(addCalendarDays(today, 1)).from }
    case 'past':
      return { to: toInclusiveRange(businessDayWindow(addCalendarDays(today, -1))).to }
  }
}

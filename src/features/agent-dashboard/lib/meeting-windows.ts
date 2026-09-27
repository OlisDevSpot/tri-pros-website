// `meetingWindow('today')` runs both server-side (RSC prefetch in Vercel's UTC
// runtime) and in the agent's browser. Deriving "today" from ambient local time
// would give server and client different query keys near the UTC/PT offset and
// a hydration mismatch, so every boundary comes from the business timezone.

import { addCalendarDays, BUSINESS_TIMEZONE, businessMonthWindow, businessToday, startOfDayInTimeZone } from '@/shared/lib/business-time'

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** LA-pinned ISO bounds [startOfMonth, startOfNextMonth) for the meetings scheduledFor filter. */
export function meetingMonthWindow(anchorCalendarDay: string): { from: string, to: string } {
  return businessMonthWindow(anchorCalendarDay.slice(0, 7))
}

/** ISO bounds for the meetings `scheduledFor` dateRange filter, business-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const todayCalendarDay = businessToday()
  const tomorrowCalendarDay = addCalendarDays(todayCalendarDay, 1)

  const startOfToday = startOfDayInTimeZone(todayCalendarDay, BUSINESS_TIMEZONE)
  const startOfTomorrow = startOfDayInTimeZone(tomorrowCalendarDay, BUSINESS_TIMEZONE)

  switch (kind) {
    case 'today':
      return { from: startOfToday.toISOString(), to: startOfTomorrow.toISOString() }
    case 'upcoming':
      return { from: startOfTomorrow.toISOString() }
    case 'past':
      return { to: startOfToday.toISOString() }
  }
}

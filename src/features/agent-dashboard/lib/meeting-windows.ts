// Day-window bounds for the agent dashboard's meeting groupings (Today /
// Upcoming / Past). Pure — no I/O, no framework deps.
//
// `meetingWindow('today')` runs BOTH server-side (RSC prefetch + SSR of the
// default-mounted Today tab, which executes in Vercel's UTC runtime) AND
// client-side (agent's browser, Southern California / America/Los_Angeles).
// If "today" were derived from ambient `new Date()` local-day math, server
// and client would compute different day boundaries near the UTC/PT offset
// (7-8h), producing different query keys → hydration mismatch. So the day
// boundary is pinned to the business timezone regardless of runtime tz —
// same constant used across the codebase (see e.g.
// src/shared/lib/formatters.ts, decide-cadence-sms.ts).

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

const BUSINESS_TIMEZONE = 'America/Los_Angeles'

/**
 * The UTC instant (as ms since epoch) that reads as `hour:minute:second` in
 * `timeZone` at the given instant. Used to find the fixed UTC offset (in ms)
 * that timezone had at that instant — positive east of UTC, negative west.
 */
function utcOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const get = (type: string) => Number(parts.find(part => part.type === type)?.value)
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asIfUtc - instant.getTime()
}

/**
 * The UTC instant of local midnight, on `timeZone`'s given `YYYY-MM-DD`
 * calendar day. Two-pass offset resolution (standard zoned-midnight
 * algorithm): the tz offset can itself depend on the instant (DST
 * transitions), so we refine once against the first guess — sufficient
 * because `BUSINESS_TIMEZONE` transitions happen at 2am local, never within
 * range of a one-guess error.
 */
function startOfDayInTimeZone(calendarDay: string, timeZone: string): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, 0, 0, 0)

  let instantMs = target - utcOffsetMs(new Date(target), timeZone)
  instantMs = target - utcOffsetMs(new Date(instantMs), timeZone)

  return new Date(instantMs)
}

/**
 * `calendarDay` (`YYYY-MM-DD`) shifted by `days`. Pure calendar-date
 * arithmetic (via a throwaway UTC `Date`, not a real instant) — deliberately
 * NOT "add 24h to today's midnight instant", since a DST-transition day is
 * 23h or 25h long and that would land on the wrong calendar date.
 */
function addCalendarDays(calendarDay: string, days: number): string {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** ISO bounds for the meetings `scheduledFor` dateRange filter, `BUSINESS_TIMEZONE`-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const now = new Date()
  const todayCalendarDay = now.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE }) // "YYYY-MM-DD"
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

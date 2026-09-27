// Day and month boundaries are pinned to the business timezone, never the
// runtime's: Vercel runs in UTC while agents are in Southern California, and a
// UTC boundary puts a 10 pm Pacific event in the next day or month.

export const BUSINESS_TIMEZONE = 'America/Los_Angeles'

/**
 * The UTC offset (ms, positive east of UTC) `timeZone` had at `instant`,
 * read back through Intl because the offset itself moves with DST.
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
 * The UTC instant of local midnight on `timeZone`'s `YYYY-MM-DD` day. Two-pass
 * offset resolution: the offset can depend on the instant (DST), so refine once
 * against the first guess — enough because Pacific transitions happen at 2 am.
 */
export function startOfDayInTimeZone(calendarDay: string, timeZone: string): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, 0, 0, 0)

  let instantMs = target - utcOffsetMs(new Date(target), timeZone)
  instantMs = target - utcOffsetMs(new Date(instantMs), timeZone)

  return new Date(instantMs)
}

/**
 * Calendar-date arithmetic, deliberately not "add 24h to midnight": a DST day
 * is 23h or 25h long and that would land on the wrong date.
 */
export function addCalendarDays(calendarDay: string, days: number): string {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function businessDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
}

export function businessToday(): string {
  return businessDayKey(new Date())
}

export function businessMonthKey(date: Date | string): string {
  return businessDayKey(new Date(date)).slice(0, 7)
}

export function businessMonthWindow(monthKey: string): { from: string, to: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return {
    from: startOfDayInTimeZone(start, BUSINESS_TIMEZONE).toISOString(),
    to: startOfDayInTimeZone(nextStart, BUSINESS_TIMEZONE).toISOString(),
  }
}

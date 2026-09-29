import { addCalendarDays, BUSINESS_TIMEZONE, startOfDayInTimeZone } from '@/shared/lib/business-time'

// TCPA quiet hours are 9 pm–8 am in the recipient's local time; every customer is in
// Southern California, so the business timezone stands in for per-customer zones.
export const SEND_WINDOW_OPEN_HOUR = 8
export const SEND_WINDOW_CLOSE_HOUR = 21

function businessHour(instant: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hourCycle: 'h23',
    hour: '2-digit',
  }).format(instant))
}

export function isWithinSendWindow(instant: Date = new Date()): boolean {
  const hour = businessHour(instant)
  return hour >= SEND_WINDOW_OPEN_HOUR && hour < SEND_WINDOW_CLOSE_HOUR
}

/** The next instant a transactional text may go out: now if the window is open, else 8 am on the next business-timezone day that has an 8 am ahead of `instant`. */
export function nextSendWindowOpen(instant: Date = new Date()): Date {
  if (isWithinSendWindow(instant)) {
    return instant
  }
  const dayKey = instant.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
  const todayOpen = new Date(startOfDayInTimeZone(dayKey, BUSINESS_TIMEZONE).getTime() + SEND_WINDOW_OPEN_HOUR * 3_600_000)
  if (todayOpen > instant) {
    return todayOpen
  }
  return new Date(startOfDayInTimeZone(addCalendarDays(dayKey, 1), BUSINESS_TIMEZONE).getTime() + SEND_WINDOW_OPEN_HOUR * 3_600_000)
}

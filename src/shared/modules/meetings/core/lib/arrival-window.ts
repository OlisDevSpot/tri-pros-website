import { MEETING_ARRIVAL_WINDOW_MS } from '@/shared/entities/meetings/constants/scheduling'
import { formatBusinessClock } from '@/shared/lib/business-time'

/** Reads after "between": "10:00 and 10:30 AM", or "11:45 AM and 12:15 PM" across noon. */
export function formatArrivalWindow(scheduledFor: string): string {
  const from = formatBusinessClock(scheduledFor)
  const to = formatBusinessClock(new Date(new Date(scheduledFor).getTime() + MEETING_ARRIVAL_WINDOW_MS))
  const [fromClock, fromPeriod] = from.split(' ')
  const [, toPeriod] = to.split(' ')
  return fromPeriod === toPeriod ? `${fromClock} and ${to}` : `${from} and ${to}`
}

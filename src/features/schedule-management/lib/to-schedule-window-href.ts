import { ROOTS } from '@/shared/config/roots'

/**
 * Links sent before the date window moved into the URL (Google Calendar event descriptions,
 * push notifications) carry `highlightDate=<ISO>`. Returns today's link for the same meeting,
 * or null when the URL isn't an old link.
 */
export function toScheduleWindowHref(searchParams: Record<string, string | string[] | undefined>): string | null {
  const { highlightMeeting, highlightDate } = searchParams
  if (typeof highlightMeeting !== 'string' || typeof highlightDate !== 'string') {
    return null
  }
  return ROOTS.dashboard.scheduleWithMeetingHighlight(highlightMeeting, highlightDate)
}

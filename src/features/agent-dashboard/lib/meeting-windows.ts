// Local-day window bounds for the agent dashboard's meeting groupings
// (Today / Upcoming / Past). Pure — no I/O, no framework deps.

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** ISO bounds for the meetings `scheduledFor` dateRange filter, local-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  switch (kind) {
    case 'today':
      return { from: startOfToday.toISOString(), to: startOfTomorrow.toISOString() }
    case 'upcoming':
      return { from: startOfTomorrow.toISOString() }
    case 'past':
      return { to: startOfToday.toISOString() }
  }
}

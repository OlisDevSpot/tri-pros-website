import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

import { format, isToday, isYesterday } from 'date-fns'

export interface TimelineDateGroup {
  label: string
  events: TimelineEvent[]
}

/** Group reverse-chron events into day buckets. Input MUST be pre-sorted desc. */
export function bucketTimelineEvents(events: TimelineEvent[]): TimelineDateGroup[] {
  const groups: TimelineDateGroup[] = []
  let current: TimelineDateGroup | null = null
  let currentKey = ''

  for (const event of events) {
    const date = new Date(event.timestamp)
    const key = format(date, 'yyyy-MM-dd')
    if (key !== currentKey) {
      currentKey = key
      const label = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMM d, yyyy')
      current = { label, events: [] }
      groups.push(current)
    }
    current!.events.push(event)
  }
  return groups
}

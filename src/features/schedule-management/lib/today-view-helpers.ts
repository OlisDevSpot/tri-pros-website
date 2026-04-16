import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { TimeBucket } from '@/shared/constants/today-view-buckets'

import { parseISO } from 'date-fns'

export interface SwimlaneOwner {
  id: string
  name: string | null
  image: string | null
}

/** Filter events whose startAt hour falls within [bucket.startHour, bucket.endHour) */
export function getEventsForBucket(
  events: ScheduleCalendarEvent[],
  bucket: TimeBucket,
): ScheduleCalendarEvent[] {
  return events
    .filter((event) => {
      const hour = parseISO(event.startAt).getHours()
      return hour >= bucket.startHour && hour < bucket.endHour
    })
    .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime())
}

/** Group events by ownerId. Only owners present in the events array get entries. */
export function groupEventsByOwner(
  events: ScheduleCalendarEvent[],
): Map<string, ScheduleCalendarEvent[]> {
  const map = new Map<string, ScheduleCalendarEvent[]>()

  for (const event of events) {
    const existing = map.get(event.ownerId)
    if (existing) {
      existing.push(event)
    }
    else {
      map.set(event.ownerId, [event])
    }
  }

  return map
}

/** Extract unique owners from events for swimlane headers. */
export function getUniqueOwners(events: ScheduleCalendarEvent[]): SwimlaneOwner[] {
  const seen = new Map<string, SwimlaneOwner>()

  for (const event of events) {
    if (!seen.has(event.ownerId)) {
      seen.set(event.ownerId, {
        id: event.ownerId,
        name: event.ownerName,
        image: event.kind === 'meeting' ? event.ownerImage : null,
      })
    }
  }

  return [...seen.values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  )
}

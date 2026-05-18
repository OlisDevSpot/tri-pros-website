import type { GCalEvent, LocalEventUpsert } from '../types'

export function gcalEventToLocal(event: GCalEvent): LocalEventUpsert {
  const isAllDay = !!event.start.date && !event.start.dateTime

  let scheduledFor: string | null = null
  if (event.start.dateTime) {
    scheduledFor = event.start.dateTime
  }
  else if (event.start.date) {
    scheduledFor = new Date(event.start.date).toISOString()
  }

  return {
    title: event.summary ?? 'Untitled Event',
    description: event.description ?? null,
    scheduledFor,
    location: event.location ?? null,
    allDay: isAllDay,
    gcalEventId: event.id,
    gcalEtag: event.etag,
  }
}

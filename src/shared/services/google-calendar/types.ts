/** Google Calendar Event resource (subset of fields we use) */
export interface GCalEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  etag: string
  updated: string // ISO 8601 timestamp
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink?: string
}

export interface GCalDateTime {
  dateTime?: string // RFC 3339 (for timed events)
  date?: string // YYYY-MM-DD (for all-day events)
  timeZone?: string
}

export interface GCalEventInput {
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
}

export interface GCalEventListResponse {
  kind: 'calendar#events'
  etag: string
  summary: string
  updated: string
  nextSyncToken?: string
  nextPageToken?: string
  items: GCalEvent[]
}

export interface GCalCalendar {
  id: string
  summary: string
  etag: string
}

export interface GCalWatchRequest {
  id: string // Channel ID (UUID)
  type: 'web_hook'
  address: string // Webhook URL
  expiration?: string // Unix timestamp in ms
}

export interface GCalWatchResponse {
  kind: 'api#channel'
  id: string
  resourceId: string
  resourceUri: string
  expiration: string // Unix timestamp in ms
}

/** Shape returned by our mapping functions for local upsert */
export interface LocalEventUpsert {
  title: string
  description: string | null
  scheduledFor: string | null // ISO timestamp
  location: string | null
  allDay: boolean
  gcalEventId: string
  gcalEtag: string
}

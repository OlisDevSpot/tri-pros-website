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
  attendees?: GCalAttendee[]
  extendedProperties?: GCalExtendedProperties
}

export type GCalSendUpdates = 'all' | 'externalOnly' | 'none'

export interface GCalAttendee {
  email: string
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  organizer?: boolean
  self?: boolean
}

export interface GCalExtendedProperties {
  private?: Record<string, string>
}

export interface GCalDateTime {
  dateTime?: string // RFC 3339 (for timed events)
  date?: string // YYYY-MM-DD (for all-day events)
  timeZone?: string
}

export interface GCalEventInput {
  /** Only on create; Google takes base32hex (0-9, a-v), 5–1024 characters, unique per calendar for good. */
  id?: string
  /** `confirmed` on a PUT brings back an event deleted under the same id. */
  status?: 'confirmed'
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  attendees?: GCalAttendee[]
  extendedProperties?: GCalExtendedProperties
  colorId?: string
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

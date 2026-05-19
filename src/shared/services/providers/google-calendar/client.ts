import type {
  GCalCalendar,
  GCalEvent,
  GCalEventInput,
  GCalEventListResponse,
  GCalWatchRequest,
  GCalWatchResponse,
} from './types'

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3'

function authHeaders(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar ${context} failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

function createGoogleCalendarClient() {
  return {
    createCalendar: async (accessToken: string, title: string): Promise<GCalCalendar> => {
      const res = await fetch(`${GCAL_BASE}/calendars`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ summary: title }),
      })
      return handleResponse<GCalCalendar>(res, 'createCalendar')
    },

    listEvents: async (
      accessToken: string,
      calendarId: string,
      syncToken?: string,
    ): Promise<GCalEventListResponse> => {
      const params = new URLSearchParams()
      if (syncToken) {
        params.set('syncToken', syncToken)
      }
      else {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        params.set('timeMin', thirtyDaysAgo.toISOString())
        params.set('singleEvents', 'true')
        params.set('orderBy', 'startTime')
      }
      params.set('maxResults', '2500')

      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: authHeaders(accessToken) },
      )

      if (res.status === 410) {
        throw new GCalSyncTokenExpiredError()
      }

      return handleResponse<GCalEventListResponse>(res, 'listEvents')
    },

    getEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
    ): Promise<GCalEvent> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: authHeaders(accessToken) },
      )
      return handleResponse<GCalEvent>(res, 'getEvent')
    },

    createEvent: async (
      accessToken: string,
      calendarId: string,
      event: GCalEventInput,
    ): Promise<GCalEvent> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(event),
        },
      )
      return handleResponse<GCalEvent>(res, 'createEvent')
    },

    updateEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
      event: GCalEventInput,
      etag?: string,
    ): Promise<GCalEvent> => {
      const headers: Record<string, string> = authHeaders(accessToken)
      if (etag) {
        headers['If-Match'] = etag
      }

      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(event),
        },
      )
      return handleResponse<GCalEvent>(res, 'updateEvent')
    },

    deleteEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
    ): Promise<void> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: authHeaders(accessToken),
        },
      )
      if (!res.ok && res.status !== 404) {
        const body = await res.text()
        throw new Error(`Google Calendar deleteEvent failed (${res.status}): ${body}`)
      }
    },

    watchEvents: async (
      accessToken: string,
      calendarId: string,
      webhookUrl: string,
      channelId: string,
    ): Promise<GCalWatchResponse> => {
      const body: GCalWatchRequest = {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      }
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(body),
        },
      )
      return handleResponse<GCalWatchResponse>(res, 'watchEvents')
    },

    stopWatch: async (
      accessToken: string,
      channelId: string,
      resourceId: string,
    ): Promise<void> => {
      const res = await fetch(
        `${GCAL_BASE}/channels/stop`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify({ id: channelId, resourceId }),
        },
      )
      if (!res.ok && res.status !== 404) {
        const body = await res.text()
        throw new Error(`Google Calendar stopWatch failed (${res.status}): ${body}`)
      }
    },
  }
}

export class GCalSyncTokenExpiredError extends Error {
  constructor() {
    super('Google Calendar sync token expired (410 Gone). Full sync required.')
    this.name = 'GCalSyncTokenExpiredError'
  }
}

export type GoogleCalendarClient = ReturnType<typeof createGoogleCalendarClient>
export const googleCalendarClient = createGoogleCalendarClient()

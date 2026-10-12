import type { GCalAttendee, GCalEvent, GCalEventInput, GCalExtendedProperties, GCalSendUpdates } from '../types'

export type CalendarNotice = 'notify' | 'none'

/** The parts of an event a guest-facing email depends on. */
export interface CalendarNoticeState {
  start: string | null
  location: string | null
  homeownerEmail: string | null
}

const HOMEOWNER_KEY = 'homeownerEmail'

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a?.toLowerCase() ?? null) === (b?.toLowerCase() ?? null)
}

// Google answers with an offset ("…-07:00") where we send UTC ("…Z"), so instants are compared, not strings.
function sameInstant(a: string | null, b: string | null): boolean {
  return a === null || b === null ? a === b : new Date(a).getTime() === new Date(b).getTime()
}

function sameLocation(a: string | null, b: string | null): boolean {
  return (a ?? '').trim() === (b ?? '').trim()
}

// The marker names the homeowner among the guests, so a later sync can tell an added, removed or changed homeowner apart from staff.
export function homeownerMarker(email: string | null): GCalExtendedProperties {
  return { private: { [HOMEOWNER_KEY]: email ?? '' } }
}

export function noticeStateFromInput(input: GCalEventInput): CalendarNoticeState {
  return {
    start: input.start.dateTime ?? null,
    location: input.location ?? null,
    homeownerEmail: input.extendedProperties?.private?.[HOMEOWNER_KEY] || null,
  }
}

// Someone can remove the homeowner in Google Calendar, so the marker counts only while they are still a guest.
export function noticeStateFromEvent(event: GCalEvent): CalendarNoticeState {
  const marked = event.extendedProperties?.private?.[HOMEOWNER_KEY] || null
  const stillGuest = marked != null && (event.attendees ?? []).some(attendee => sameEmail(attendee.email, marked))
  return { start: event.start.dateTime ?? null, location: event.location ?? null, homeownerEmail: stillGuest ? marked : null }
}

/**
 * Whether Google should email the homeowner about this write. Compared against Google's copy, not our history,
 * so a retried job or an edit already made in Google Calendar never sends a second email.
 */
export function decideCalendarNotice(current: CalendarNoticeState | null, next: CalendarNoticeState): CalendarNotice {
  const before = current?.homeownerEmail ?? null
  if (!sameEmail(before, next.homeownerEmail)) {
    return 'notify'
  }
  if (current === null || next.homeownerEmail === null) {
    return 'none'
  }
  return sameInstant(current.start, next.start) && sameLocation(current.location, next.location) ? 'none' : 'notify'
}

export function decideCancellationNotice(input: { homeownerInvited: boolean, scheduledFor: string, now: Date }): CalendarNotice {
  return input.homeownerInvited && new Date(input.scheduledFor).getTime() > input.now.getTime() ? 'notify' : 'none'
}

/**
 * externalOnly keeps staff, who share the company domain, out of the emails. Outside production staff are
 * never guests and the override inbox shares that domain, so only `all` reaches it.
 * Anything but 'notify' maps to none: a delete job queued before notices existed carries no notice.
 */
export function toSendUpdates(notice: CalendarNotice, env: { isProduction: boolean }): GCalSendUpdates {
  if (notice !== 'notify') {
    return 'none'
  }
  return env.isProduction ? 'externalOnly' : 'all'
}

// A full-event PUT that lists a guest without their answer can reset it.
export function carryAttendeeResponses(next: GCalAttendee[], current: readonly GCalAttendee[] | undefined): GCalAttendee[] {
  return next.map((attendee) => {
    const responseStatus = current?.find(existing => sameEmail(existing.email, attendee.email))?.responseStatus
    return responseStatus ? { ...attendee, responseStatus } : attendee
  })
}

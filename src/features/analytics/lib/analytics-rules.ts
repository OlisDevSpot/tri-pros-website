import type { BookedLead, LeadAnchor, MeetingOrder } from '@/features/analytics/types'
import type { MeetingSit } from '@/shared/constants/enums/meetings'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'

import { compareRecordAge } from '@/shared/entities/customers/lib/group-duplicate-people'

/** Website intake writes these placeholders when a lead gives no address. */
export const UNKNOWN_PLACE_VALUES: readonly string[] = ['Unknown', '']

export function toKnownPlace(value: string): string | null {
  const trimmed = value.trim()
  return UNKNOWN_PLACE_VALUES.includes(trimmed) ? null : trimmed
}

/** A lead is credited to the person's first contact with us; a later duplicate record never re-credits it. */
export function pickLeadAnchor(records: readonly CustomerFact[]): LeadAnchor {
  const earliest = [...records].sort(compareRecordAge)[0]
  return {
    leadAt: earliest.createdAt,
    leadSourceId: earliest.leadSourceId,
    city: toKnownPlace(earliest.city),
    zip: toKnownPlace(earliest.zip),
  }
}

/**
 * `first` is the first real sit: a cancelled or no-show meeting before it (a
 * reschedule's original) is noise, not the first visit. Expects oldest first.
 */
export function deriveMeetingOrder(chronological: readonly { project: boolean, sit: MeetingSit }[]): MeetingOrder[] {
  const firstSitIndex = chronological.findIndex(m => !m.project && m.sit === 'sat')
  return chronological.map((m, index) => {
    if (m.project) {
      return 'project'
    }
    if (index === firstSitIndex) {
      return 'first'
    }
    return firstSitIndex !== -1 && index > firstSitIndex ? 'repeat' : 'not_sat'
  })
}

/**
 * A customer is booked once, however many times they reschedule; the booking
 * lands on the sit when there was one, so sits can never exceed booked leads.
 * Expects oldest first.
 */
export function pickBookedLead(chronological: readonly { id: string, at: string, project: boolean, sit: MeetingSit }[]): BookedLead | null {
  const leadMeetings = chronological.filter(m => !m.project)
  const firstSit = leadMeetings.find(m => m.sit === 'sat')
  const picked = firstSit ?? leadMeetings[0]
  return picked ? { at: picked.at, meetingId: picked.id, sat: picked === firstSit } : null
}

/** A past meeting nobody has given an outcome yet is unknown, not a no-show — surfaced so it gets fixed. */
export function isUnresolvedMeeting(meeting: { sit: MeetingSit, at: string }, now: Date): boolean {
  return meeting.sit === 'unknown' && Date.parse(meeting.at) < now.getTime()
}

/**
 * Stage-to-stage rates over the same period. Close rate uses new sales only:
 * an upsell never came through a new-lead sit.
 */
export const ANALYTICS_RATES = {
  bookingRate: { numerator: 'bookedLeads', denominator: 'validLeads' },
  sitRate: { numerator: 'sits', denominator: 'bookedLeads' },
  closeRate: { numerator: 'newSales', denominator: 'sits' },
} as const

export type AnalyticsRateKey = keyof typeof ANALYTICS_RATES

export function computeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null
  }
  return numerator / denominator
}

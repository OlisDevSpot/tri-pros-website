import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { TimeBucket } from '@/shared/constants/today-view-buckets'
import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { parseISO } from 'date-fns'

export interface SwimlaneCombo {
  /** Canonical combo key = participant user ids sorted asc, joined by `|`. */
  key: string
  participants: UserOverviewCardUser[]
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

/**
 * Canonical combo key for an event. Meetings use their participants array
 * (already sorted asc by user id upstream); activities collapse to their
 * single ownerId so they still land in a lane.
 */
function getComboKey(event: ScheduleCalendarEvent): string {
  if (event.kind === 'meeting') {
    return event.participants.map(p => p.id).join('|')
  }
  return event.ownerId
}

/**
 * Convert an event into the participants array used for swimlane labels.
 * Meetings expose their full participant list; activities fall back to a
 * single-user synthesis from ownerId/ownerName.
 */
function getComboParticipants(event: ScheduleCalendarEvent): UserOverviewCardUser[] {
  if (event.kind === 'meeting') {
    return event.participants.map(p => ({ id: p.id, name: p.name, image: p.image }))
  }
  return [{ id: event.ownerId, name: event.ownerName, image: null }]
}

/**
 * Group events by canonical participant combo. `{A}` solo and `{A,B}` joint
 * are distinct lanes — an agent in a joint meeting is NOT shown as free in
 * their solo lane during that time.
 */
export function groupEventsByParticipantCombo(
  events: ScheduleCalendarEvent[],
): Map<string, ScheduleCalendarEvent[]> {
  const map = new Map<string, ScheduleCalendarEvent[]>()

  for (const event of events) {
    const key = getComboKey(event)
    const existing = map.get(key)
    if (existing) {
      existing.push(event)
    }
    else {
      map.set(key, [event])
    }
  }

  return map
}

/**
 * Extract unique participant combos from events for swimlane headers.
 * Sort order: combo size descending (bigger teams first), then alphabetical
 * by first participant name.
 */
export function getUniqueCombos(events: ScheduleCalendarEvent[]): SwimlaneCombo[] {
  const seen = new Map<string, SwimlaneCombo>()

  for (const event of events) {
    const key = getComboKey(event)
    if (!seen.has(key)) {
      seen.set(key, { key, participants: getComboParticipants(event) })
    }
  }

  return [...seen.values()].sort((a, b) => {
    const sizeDiff = b.participants.length - a.participants.length
    if (sizeDiff !== 0) {
      return sizeDiff
    }
    const aName = a.participants[0]?.name ?? ''
    const bName = b.participants[0]?.name ?? ''
    return aName.localeCompare(bName)
  })
}

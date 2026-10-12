import type { GCalAttendee } from '../types'

export interface MeetingGuests {
  attendees: GCalAttendee[]
  homeownerEmail: string | null
}

/**
 * Production invites the participants and, once invited, the homeowner. Outside production the dev database
 * holds real people, so staff are never guests and the homeowner is the override inbox or nobody.
 */
export function resolveMeetingGuests(input: {
  isProduction: boolean
  staffEmails: readonly string[]
  invitedHomeownerEmail: string | null
  devOverride: string | null
}): MeetingGuests {
  const staff = input.isProduction ? input.staffEmails : []
  const homeownerEmail = input.isProduction ? input.invitedHomeownerEmail : (input.invitedHomeownerEmail && input.devOverride) || null
  const seen = new Set<string>()
  const attendees: GCalAttendee[] = []
  for (const email of [...staff, ...(homeownerEmail ? [homeownerEmail] : [])]) {
    if (!seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase())
      attendees.push({ email })
    }
  }
  return { attendees, homeownerEmail }
}

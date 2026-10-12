import type { GCalEventInput } from '../types'
import type { MeetingGuests } from './meeting-guests'

import { companyInfo } from '@/shared/constants/company'
import { GCAL_ACTIVITY_COLORS, GCAL_MEETING_COLORS } from '@/shared/constants/gcal-colors'
import { homeownerMarker } from './calendar-notice'

interface TradeSelectionForGCal {
  tradeName: string
  selectedScopes: { label: string }[]
}

export interface MeetingForGCal {
  id: string
  scheduledFor: string | null
  meetingType: string | null
  projectId: string | null
  // Customer info
  customerName: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  // Meeting details
  visitNote: string | null
  homeownerInvitedAt: string | null
  shareToken: string
  tradeSelections: TradeSelectionForGCal[]
  // GCal sync fields
  gcalEventId: string | null
  gcalEtag: string | null
  // Participant emails for attendees
  participantEmails: string[]
}

interface ActivityForGCal {
  id: string
  type: string
  title: string
  description: string | null
  scheduledFor: string | null
  metaJSON: unknown
}

const DEFAULT_MEETING_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours

function buildMeetingAddress(meeting: MeetingForGCal): string | undefined {
  const parts = [
    meeting.customerAddress,
    [meeting.customerCity, meeting.customerState, meeting.customerZip].filter(Boolean).join(', '),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : undefined
}

export interface MeetingEventExtras {
  visitLink: string
  /** Formatted for reading, e.g. "(818) 555-0100". */
  questionsPhone: string
  guests: MeetingGuests
}

// Homeowners may be guests, so the event holds nothing internal: no notes, contact details or dashboard links.
function buildMeetingDescription(meeting: MeetingForGCal, extras: MeetingEventExtras): string {
  const sections: string[] = []
  const note = meeting.visitNote?.trim()
  if (note) {
    sections.push(note)
  }
  if (meeting.tradeSelections.length > 0) {
    const tradeLines = meeting.tradeSelections.map((trade) => {
      const scopes = trade.selectedScopes.map(scope => scope.label).join(', ')
      return scopes ? `• ${trade.tradeName}: ${scopes}` : `• ${trade.tradeName}`
    })
    sections.push(`What we'll look at:\n${tradeLines.join('\n')}`)
  }
  sections.push(`Your visit page: ${extras.visitLink}`)
  sections.push(`Questions? Call or text ${companyInfo.nickname} at ${extras.questionsPhone}`)
  return sections.join('\n\n')
}

export function meetingToGCalEvent(meeting: MeetingForGCal, extras: MeetingEventExtras): GCalEventInput | null {
  if (!meeting.scheduledFor) {
    return null
  }

  const start = new Date(meeting.scheduledFor)
  const end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MS)

  const colorId = meeting.projectId
    ? GCAL_MEETING_COLORS.Project
    : GCAL_MEETING_COLORS[meeting.meetingType as keyof typeof GCAL_MEETING_COLORS] ?? GCAL_MEETING_COLORS.Fresh

  const customerName = meeting.customerName ?? 'No customer'

  return {
    summary: meeting.projectId ? `Project: ${customerName}` : `Home visit: ${customerName} · ${companyInfo.name}`,
    description: buildMeetingDescription(meeting, extras),
    location: buildMeetingAddress(meeting),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
    attendees: extras.guests.attendees,
    extendedProperties: homeownerMarker(extras.guests.homeownerEmail),
  }
}

export function activityToGCalEvent(activity: ActivityForGCal): GCalEventInput | null {
  if (!activity.scheduledFor) {
    return null
  }

  const meta = activity.metaJSON as { allDay?: boolean, location?: string } | null
  const isAllDay = meta?.allDay ?? false
  const colorId = GCAL_ACTIVITY_COLORS[activity.type as keyof typeof GCAL_ACTIVITY_COLORS]

  if (isAllDay) {
    const dateStr = activity.scheduledFor.split('T')[0]
    return {
      summary: `[${activity.type}] ${activity.title}`,
      description: activity.description ?? undefined,
      location: meta?.location ?? undefined,
      start: { date: dateStr },
      end: { date: dateStr },
      colorId,
    }
  }

  const start = new Date(activity.scheduledFor)
  const end = new Date(start.getTime() + 60 * 60 * 1000) // Default 1 hour

  return {
    summary: `[${activity.type}] ${activity.title}`,
    description: activity.description ?? undefined,
    location: meta?.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
  }
}

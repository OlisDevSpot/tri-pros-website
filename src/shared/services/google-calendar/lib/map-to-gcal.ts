import type { GCalEventInput } from '../types'

import { ROOTS } from '@/shared/config/roots'
import { GCAL_ACTIVITY_COLORS, GCAL_MEETING_COLORS } from '@/shared/constants/gcal-colors'

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
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  // Meeting details
  agentNotes: string | null
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

function buildMeetingDescription(meeting: MeetingForGCal): string {
  const sections: string[] = []

  // Customer contact info
  const contactLines: string[] = []
  if (meeting.customerPhone) {
    contactLines.push(`Phone: ${meeting.customerPhone}`)
  }
  if (meeting.customerEmail) {
    contactLines.push(`Email: ${meeting.customerEmail}`)
  }
  if (contactLines.length > 0) {
    sections.push(`CUSTOMER CONTACT\n${contactLines.join('\n')}`)
  }

  // Trade/scope selections
  if (meeting.tradeSelections.length > 0) {
    const tradeLines = meeting.tradeSelections.map((t) => {
      const scopes = t.selectedScopes.map(s => s.label).join(', ')
      return scopes ? `• ${t.tradeName}: ${scopes}` : `• ${t.tradeName}`
    })
    sections.push(`TRADES & SCOPES\n${tradeLines.join('\n')}`)
  }

  // Agent notes
  if (meeting.agentNotes) {
    sections.push(`NOTES\n${meeting.agentNotes}`)
  }

  // Dashboard deep link
  const dashboardUrl = ROOTS.dashboard.meetings.byId(meeting.id, { absolute: true, isProduction: true })
  sections.push(`🔗 View in Dashboard: ${dashboardUrl}`)

  // Footer
  sections.push('— Synced from Tri Pros Remodeling')

  return sections.join('\n\n')
}

export function meetingToGCalEvent(meeting: MeetingForGCal): GCalEventInput | null {
  if (!meeting.scheduledFor) {
    return null
  }

  const start = new Date(meeting.scheduledFor)
  const end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MS)

  const colorId = meeting.projectId
    ? GCAL_MEETING_COLORS.Project
    : GCAL_MEETING_COLORS[meeting.meetingType as keyof typeof GCAL_MEETING_COLORS] ?? GCAL_MEETING_COLORS.Fresh

  const prefix = meeting.projectId
    ? 'Project'
    : meeting.meetingType ?? 'Meeting'

  return {
    summary: `${prefix}: ${meeting.customerName ?? 'No Customer'}`,
    description: buildMeetingDescription(meeting),
    location: buildMeetingAddress(meeting),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
    attendees: meeting.participantEmails.map(email => ({ email })),
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

import type { inferRouterOutputs } from '@trpc/server'

import type { ScheduleMeetingEvent } from '@/features/schedule-management/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function toCalendarEvent(meeting: MeetingRow): ScheduleMeetingEvent {
  return {
    kind: 'meeting',
    id: meeting.id,
    meetingId: meeting.id,
    startAt: meeting.scheduledFor ?? meeting.createdAt,
    title: meeting.customerName ?? 'Unknown',
    meetingType: meeting.meetingType,
    meetingOutcome: meeting.meetingOutcome,
    customerId: meeting.customerId,
    ownerId: meeting.ownerId,
    ownerName: meeting.ownerName,
    ownerImage: meeting.ownerImage,
    participants: meeting.participants,
    customerName: meeting.customerName,
    customerPhone: meeting.customerPhone,
    customerHasSentProposal: meeting.customerHasSentProposal,
    customerAddress: meeting.customerAddress,
    customerCity: meeting.customerCity,
    customerState: meeting.customerState,
    customerZip: meeting.customerZip,
    createdAt: meeting.createdAt,
  }
}

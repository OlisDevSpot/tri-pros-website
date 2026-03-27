import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function toCalendarEvent(meeting: MeetingRow): MeetingCalendarEvent {
  return {
    id: meeting.id,
    meetingId: meeting.id,
    startAt: meeting.scheduledFor ?? meeting.createdAt,
    title: meeting.customerName ?? 'Unknown',
    meetingType: meeting.meetingType,
    meetingOutcome: meeting.meetingOutcome,
    ownerId: meeting.ownerId,
    ownerName: meeting.ownerName,
    ownerImage: meeting.ownerImage,
    customerName: meeting.customerName,
    customerPhone: meeting.customerPhone,
    customerAddress: meeting.customerAddress,
    customerCity: meeting.customerCity,
    customerState: meeting.customerState,
    customerZip: meeting.customerZip,
    createdAt: meeting.createdAt,
  }
}

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
    meetingOutcome: meeting.meetingOutcome,
    selectedProgram: meeting.flowStateJSON?.selectedProgram ?? null,
    customerName: meeting.customerName,
    customerPhone: meeting.customerPhone,
    customerAddress: meeting.customerAddress,
    customerCity: meeting.customerCity,
    customerState: meeting.customerState,
    customerZip: meeting.customerZip,
    createdAt: meeting.createdAt,
  }
}

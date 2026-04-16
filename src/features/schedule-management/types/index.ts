import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'

export interface ScheduleMeetingEvent extends CalendarEvent {
  kind: 'meeting'
  meetingId: string
  meetingType: string | null
  meetingOutcome: MeetingOutcome
  customerId: string | null
  ownerId: string
  ownerName: string | null
  ownerImage: string | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  createdAt: string
}

export interface ScheduleActivityEvent extends CalendarEvent {
  kind: 'activity'
  activityId: string
  activityType: ActivityType
  description: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string
  ownerName: string | null
  dueAt: string | null
  completedAt: string | null
}

export type ScheduleCalendarEvent = ScheduleMeetingEvent | ScheduleActivityEvent

export type ScheduleTableTab = 'meetings' | 'activities'

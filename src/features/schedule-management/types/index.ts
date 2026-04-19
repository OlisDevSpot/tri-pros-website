import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { ActivityType, MeetingOutcome, MeetingParticipantRole } from '@/shared/constants/enums'

export interface ScheduleMeetingParticipant {
  /** User id — stable combo-key input. */
  id: string
  name: string | null
  image: string | null
  role: MeetingParticipantRole
}

export interface ScheduleMeetingEvent extends CalendarEvent {
  kind: 'meeting'
  meetingId: string
  meetingType: string | null
  meetingOutcome: MeetingOutcome
  customerId: string | null
  ownerId: string
  ownerName: string | null
  ownerImage: string | null
  /**
   * All participants for this meeting (owner + co_owner + helpers).
   * Sorted ascending by user id upstream so combo keys derived from this array
   * are canonical across different orderings (e.g. swimlane grouping).
   */
  participants: ScheduleMeetingParticipant[]
  customerName: string | null
  customerPhone: string | null
  /** True when the linked customer has at least one sent proposal — used by gated phone rendering. */
  customerHasSentProposal: boolean
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

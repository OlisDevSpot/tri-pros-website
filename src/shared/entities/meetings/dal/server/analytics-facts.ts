import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'

import { getAllParticipantsForMeetings } from './participants'

export interface MeetingFact {
  id: string
  customerId: string | null
  meetingType: MeetingType
  meetingOutcome: MeetingOutcome
  scheduledFor: string
  projectId: string | null
  closerIds: string[]
}

// System-level read: every meeting, unscoped — analytics callers are super-admin gated at the router.
export async function listMeetingFacts(): Promise<DalReturn<MeetingFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: meetings.id,
        customerId: meetings.customerId,
        meetingType: meetings.meetingType,
        meetingOutcome: meetings.meetingOutcome,
        scheduledFor: meetings.scheduledFor,
        projectId: meetings.projectId,
      })
      .from(meetings)

    const participants = await getAllParticipantsForMeetings(rows.map(row => row.id))
    const closerIdsByMeeting = new Map<string, string[]>()
    for (const participant of participants) {
      const closerIds = closerIdsByMeeting.get(participant.meetingId) ?? []
      closerIds.push(participant.userId)
      closerIdsByMeeting.set(participant.meetingId, closerIds)
    }

    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({
      ...row,
      scheduledFor: new Date(row.scheduledFor).toISOString(),
      closerIds: closerIdsByMeeting.get(row.id) ?? [],
    }))
  })
}

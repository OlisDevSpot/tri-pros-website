import type { SQL } from 'drizzle-orm'
import { and, eq, exists } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, meetings } from '@/shared/db/schema'

// Raw SQL builder for customer visibility. see ../../DOCS.md#visibility-via-meeting-participation
// Companion to `userParticipatesInMeeting` (one level lower in the join);
// keep them in sync if the participation model changes.
export function userCanSeeCustomer(userId: string, customerIdColumn: SQL | unknown): SQL {
  return exists(
    db.select({ id: meetingParticipants.id })
      .from(meetings)
      .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
      .where(and(
        eq(meetings.customerId, customerIdColumn as SQL),
        eq(meetingParticipants.userId, userId),
      )),
  )
}

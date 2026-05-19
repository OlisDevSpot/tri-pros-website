import type { SQL } from 'drizzle-orm'
import { and, eq, exists } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, meetings } from '@/shared/db/schema'

// Canonical agent-visibility predicate for the customers entity.
//
// Rule: a non-omni user (an agent) can see a customer only when they are a
// participant — any role — of at least one meeting tied to that customer.
// Customers have no direct owner column; meeting participation is the bridge.
//
// Super-admins ("manage all") bypass scoping entirely — callers pass
// `undefined` instead of calling this helper for that case.
//
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

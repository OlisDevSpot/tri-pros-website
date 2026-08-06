import type { SQL } from 'drizzle-orm'
import { and, eq, exists } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, meetings, projects } from '@/shared/db/schema'

/**
 * A project is "owned" by a user when they participate in ≥1 of its meetings.
 * See docs/superpowers/specs/2026-08-06-adaptive-agent-dashboard-design.md §6.
 */
export function projectParticipationScope(userId: string): SQL {
  return exists(
    db
      .select({ id: meetings.id })
      .from(meetings)
      .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
      .where(and(
        eq(meetings.projectId, projects.id),
        eq(meetingParticipants.userId, userId),
      )),
  )
}

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

/**
 * SQL predicate for a "real" project: one with ≥1 meeting linked to it
 * (`meetings.projectId`). A project with NO meetings is a pure-portfolio entry
 * (created via the portfolio editor to showcase work, never from an approved
 * proposal) and must be disregarded in operational lists, analytics, and
 * aggregations. This is the server-side twin of `isPurePortfolioProject`
 * (negated). Applies even for omni users, whose visibility scope is otherwise
 * unbounded. See ../DOCS.md#pure-portfolio-projects-are-not-real-projects
 */
export function hasAssociatedMeeting(): SQL {
  return exists(
    db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.projectId, projects.id)),
  )
}

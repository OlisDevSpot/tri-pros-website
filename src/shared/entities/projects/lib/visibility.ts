import type { SQL } from 'drizzle-orm'
import { eq, exists } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetings, projects } from '@/shared/db/schema'

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

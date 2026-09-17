/**
 * A **pure-portfolio project** is a showcase-only entry: it was created to
 * display work on the marketing portfolio, NOT minted from an approved proposal,
 * so it never ran the signed→closed lifecycle. The distinguishing fact is that
 * it has **no meetings** associated with it — a real project always originates
 * from a birthing meeting (`meetings.projectId`), so a project with zero
 * meetings is portfolio-only.
 *
 * Pure-portfolio projects must be disregarded in operational lists, analytics,
 * filtering, and aggregations. This is the row-level predicate (for shapes that
 * carry their meetings, e.g. `CustomerProfileProject`); the server-side twin for
 * list/aggregation queries is `hasAssociatedMeeting()` in `./visibility.ts`.
 *
 * See ../DOCS.md#pure-portfolio-projects-are-not-real-projects
 */
export function isPurePortfolioProject(project: { meetings?: readonly unknown[] | null }): boolean {
  return (project.meetings?.length ?? 0) === 0
}

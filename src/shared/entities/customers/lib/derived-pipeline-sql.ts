import type { SQL } from 'drizzle-orm'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { and, eq, exists, inArray, not, notInArray, sql } from 'drizzle-orm'
import { POSITIVE_OUTCOMES, RECALLABLE_OUTCOMES, TERMINAL_OUTCOMES } from '@/shared/constants/enums/meetings'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'

/**
 * Server-only SQL for the 5-bucket derived pipeline, computed PURELY from
 * `meetings.meetingOutcome` + project existence — no stored `.pipeline` column
 * is read. see ../DOCS.md#derived-5-bucket-pipeline
 *
 * Correlated `EXISTS` subqueries are built with drizzle's query builder (same
 * pattern as the meeting-participation scope operators); `customers.id` inside
 * each `where` correlates to the outer `customers` row.
 */

/** `EXISTS (… WHERE m.customer_id = customers.id AND <extra>)` for the outer customer. */
function existsMeeting(extra?: SQL) {
  return exists(
    db.select({ one: sql`1` }).from(meetings)
      .where(and(eq(meetings.customerId, customers.id), extra)),
  )
}

/**
 * Select-column SQL returning the 5-bucket pipeline for the outer `customers`
 * row. Priority-ordered, first-match, total:
 *   projects — has a project OR ≥1 positive outcome
 *   leads    — no meetings
 *   fresh    — ≥1 non-negative meeting (no positive/project by prior arms)
 *   rehash   — all meetings negative, ≥1 recallable (mixed recallable+terminal → rehash)
 *   dead     — all meetings negative, all terminal
 */
export function derivedPipelineSql() {
  const negatives = [...RECALLABLE_OUTCOMES, ...TERMINAL_OUTCOMES]
  const hasProject = exists(
    db.select({ one: sql`1` }).from(projects).where(eq(projects.customerId, customers.id)),
  )
  const hasPositive = existsMeeting(inArray(meetings.meetingOutcome, POSITIVE_OUTCOMES))
  const hasNonNegative = existsMeeting(notInArray(meetings.meetingOutcome, negatives))
  const hasRecallable = existsMeeting(inArray(meetings.meetingOutcome, RECALLABLE_OUTCOMES))

  return sql<Pipeline>`CASE
    WHEN ${hasProject} OR ${hasPositive} THEN 'projects'
    WHEN ${not(existsMeeting())} THEN 'leads'
    WHEN ${hasNonNegative} THEN 'fresh'
    WHEN ${hasRecallable} THEN 'rehash'
    ELSE 'dead'
  END`
}

/** WHERE predicate matching customers in the given pipelines. Empty array → undefined (composes with `and(...)`). */
export function derivedPipelineWhere(values: readonly Pipeline[]): SQL | undefined {
  if (values.length === 0) {
    return undefined
  }
  return inArray(derivedPipelineSql(), [...values])
}

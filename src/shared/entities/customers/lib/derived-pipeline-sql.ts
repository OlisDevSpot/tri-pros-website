import type { SQL } from 'drizzle-orm'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { inArray, sql } from 'drizzle-orm'
import { customers } from '@/shared/db/schema/customers'

/**
 * Server-only SQL helpers for the 5-bucket derived pipeline.
 * see ../DOCS.md#derived-5-bucket-pipeline
 *
 * Same `"customers"."id"` literal pattern as phone-gating-sql.ts to avoid
 * drizzle's ambiguous emission of the outer column inside the subquery.
 */

const EXISTS_PROJECT = sql`EXISTS (
  SELECT 1 FROM projects p
  WHERE p.customer_id = "customers"."id"
)`

const EXISTS_MEETING = sql`EXISTS (
  SELECT 1 FROM meetings m
  WHERE m.customer_id = "customers"."id"
)`

/** Select-column SQL returning the 5-bucket pipeline for the outer `customers` row. */
export function derivedPipelineSql() {
  return sql<Pipeline>`CASE
    WHEN ${customers.pipeline} = 'rehash' THEN 'rehash'
    WHEN ${customers.pipeline} = 'dead' THEN 'dead'
    WHEN ${EXISTS_PROJECT} THEN 'projects'
    WHEN ${EXISTS_MEETING} THEN 'fresh'
    ELSE 'leads'
  END`
}

/** WHERE predicate matching customers in the given pipelines. Empty array → undefined (composes with `and(...)`). */
export function derivedPipelineWhere(values: readonly Pipeline[]): SQL | undefined {
  if (values.length === 0) {
    return undefined
  }
  return inArray(derivedPipelineSql(), [...values])
}

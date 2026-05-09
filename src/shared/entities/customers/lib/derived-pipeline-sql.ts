import type { SQL } from 'drizzle-orm'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { inArray, sql } from 'drizzle-orm'
import { customers } from '@/shared/db/schema/customers'

/**
 * Derived 5-bucket pipeline classification for a customer row.
 * Server-only: do not import in client code.
 *
 * The customers table physically stores a coarse 3-bucket pipeline
 * (`active | rehash | dead`). UX surfaces classify against the canonical
 * 5-bucket `pipelines` enum (`projects | fresh | leads | rehash | dead`)
 * by exploding the `active` bucket based on what records the customer has:
 *
 *   - rehash | dead     → passthrough
 *   - active + project  → 'projects'
 *   - active + meeting  → 'fresh'
 *   - active otherwise  → 'leads'
 *
 * Same correlated-subquery convention as `phone-gating-sql.ts`: the outer
 * `customers` row is referenced as the literal `"customers"."id"` because
 * drizzle's unaliased emission of the outer column becomes ambiguous with
 * inner aliases (`p.id`, `m.id`) inside the subquery.
 */

const EXISTS_PROJECT = sql`EXISTS (
  SELECT 1 FROM projects p
  WHERE p.customer_id = "customers"."id"
)`

const EXISTS_MEETING = sql`EXISTS (
  SELECT 1 FROM meetings m
  WHERE m.customer_id = "customers"."id"
)`

/**
 * SQL expression returning the 5-bucket pipeline classification for the
 * outer `customers` row. Use as a `select` column in any list query that
 * surfaces `pipeline` to a customer-table consumer.
 */
export function derivedPipelineSql() {
  return sql<Pipeline>`CASE
    WHEN ${customers.pipeline} = 'rehash' THEN 'rehash'
    WHEN ${customers.pipeline} = 'dead' THEN 'dead'
    WHEN ${EXISTS_PROJECT} THEN 'projects'
    WHEN ${EXISTS_MEETING} THEN 'fresh'
    ELSE 'leads'
  END`
}

/**
 * WHERE predicate matching customers whose derived pipeline is in `values`.
 * Empty array returns `undefined` (no constraint), so it composes safely
 * with `and(...)` inside `buildFilterWhere`.
 */
export function derivedPipelineWhere(values: readonly Pipeline[]): SQL | undefined {
  if (values.length === 0) {
    return undefined
  }
  return inArray(derivedPipelineSql(), [...values])
}

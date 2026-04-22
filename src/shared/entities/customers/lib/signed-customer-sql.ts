import { sql } from 'drizzle-orm'

/**
 * SQL helpers for "signed customer" status. Server-only.
 *
 * Definition: a customer is signed when they have at least one project.
 * Projects are the business symbol of a converted customer — the rule lives
 * here so every router, job, and aggregate counts signed customers the
 * same way.
 *
 * Implementation note: the correlated subquery references the outer
 * customer as the literal `"customers"."id"` (not `${customers.id}`
 * interpolation), because drizzle's unaliased emission of the outer
 * column becomes just `"id"` inside the subquery — ambiguous with
 * `p.id`. The literal is table-safe since every consumer selects FROM
 * `customers`. See `phone-gating-sql.ts` for the same pattern.
 */

const EXISTS_PROJECT = sql`EXISTS (
  SELECT 1 FROM projects p
  WHERE p.customer_id = "customers"."id"
)`

export function isSignedCustomerSql() {
  return sql<boolean>`${EXISTS_PROJECT}`
}

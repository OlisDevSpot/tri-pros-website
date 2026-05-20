import { sql } from 'drizzle-orm'

/**
 * Server-only SQL helper for the "signed customer" status.
 * see ../DOCS.md#signed-customer-eq-has-project
 *
 * Same `"customers"."id"` literal pattern as phone-gating-sql.ts.
 */

const EXISTS_PROJECT = sql`EXISTS (
  SELECT 1 FROM projects p
  WHERE p.customer_id = "customers"."id"
)`

export function isSignedCustomerSql() {
  return sql<boolean>`${EXISTS_PROJECT}`
}

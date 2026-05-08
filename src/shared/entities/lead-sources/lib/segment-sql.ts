import type { SQL } from 'drizzle-orm'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { customers } from '@/shared/db/schema/customers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'

export type CustomerSegment = 'all' | 'active' | 'signed' | 'dead'

export const customerSegments = ['all', 'active', 'signed', 'dead'] as const

/**
 * SQL predicate for the 4-state customer segmentation used by the lead-source
 * detail panel.
 *
 *   - all    → no constraint (returns undefined)
 *   - signed → has at least one project (canonical via isSignedCustomerSql)
 *   - dead   → pipeline = 'dead' AND not signed (a signed customer remains in
 *              "signed" even if pipeline later flips to dead)
 *   - active → pipeline IN ('active', 'rehash') AND not signed
 *
 * Invariant the consumer relies on: active + signed + dead === all (counts
 * partition the customer set, no double-count, no orphans).
 */
export function buildSegmentWhere(segment: CustomerSegment | undefined): SQL | undefined {
  if (!segment || segment === 'all') {
    return undefined
  }
  if (segment === 'signed') {
    return isSignedCustomerSql()
  }
  const notSigned = sql<boolean>`NOT ${isSignedCustomerSql()}`
  if (segment === 'dead') {
    return and(eq(customers.pipeline, 'dead'), notSigned)
  }
  // active
  return and(inArray(customers.pipeline, ['active', 'rehash']), notSigned)
}

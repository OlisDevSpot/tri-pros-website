import type { SQL } from 'drizzle-orm'
import type { CustomerSegment } from '@/shared/entities/lead-sources/constants/customer-segments'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { customers } from '@/shared/db/schema/customers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'

/**
 * Customer segmentation predicate for the lead-source detail panel. The
 * active/signed/dead/all partition invariant is essential for KPI accuracy.
 * see ../DOCS.md#customer-segmentation-partition
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

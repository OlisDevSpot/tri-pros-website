// Column selection for the `customer_profiles` 1:1 child-table join. Used by
// every flattened-spread leftJoin site: customers getCustomer, the
// customer-pipelines getCustomerProfile feature query, and the meetings
// getByIdWithJoins nested-customer projection.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10

import { getTableColumns } from 'drizzle-orm'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'

/** Strips the FK (`customerId`) and timestamps, leaving the 23 profile columns. */
export function profileCols() {
  const { customerId: _customerId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = getTableColumns(customerProfiles)
  return rest
}

import type { SQL } from 'drizzle-orm'

import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/**
 * Canonical agent-visibility predicate for the customers entity.
 * Wraps `userCanSeeCustomer` into the `(userId) => SQL` shape
 * that EntityServerSpec.visibility expects.
 */
export function customerVisibility(userId: string): SQL {
  return userCanSeeCustomer(userId, customers.id)
}

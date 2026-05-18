import type { SQL } from 'drizzle-orm'

import { userCanSeeCustomer } from '@/shared/dal/server/customers/visibility'
import { customers } from '@/shared/db/schema'

/**
 * Canonical agent-visibility predicate for the customers entity.
 * Wraps `userCanSeeCustomer` into the `(userId) => SQL` shape
 * that EntityServerSpec.visibility expects.
 */
export function customerVisibility(userId: string): SQL {
  return userCanSeeCustomer(userId, customers.id)
}

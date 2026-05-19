import type { SQL } from 'drizzle-orm'

import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-meeting-participation */
export function customerVisibility(userId: string): SQL {
  return userCanSeeCustomer(userId, customers.id)
}

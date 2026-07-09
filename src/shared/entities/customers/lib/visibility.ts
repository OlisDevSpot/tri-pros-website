import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customers } from '@/shared/db/schema'
import { leadsPoolVisibility, userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/** see ../DOCS.md#visibility-via-meeting-participation and #derived-5-bucket-pipeline */
export function customerVisibility({ userId, ability }: VisibilityScope): SQL {
  // Dispatchers work the shared leads pool (active, no meeting yet) — a different
  // predicate than agent participation-scoping, not a widening of it.
  if (ability.can('read', 'LeadsPool')) {
    return leadsPoolVisibility()
  }
  return userCanSeeCustomer(userId, customers.id)
}

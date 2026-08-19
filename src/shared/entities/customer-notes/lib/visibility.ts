import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customerNotes } from '@/shared/db/schema/customer-notes'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/**
 * Agent-visibility predicate — a note is visible iff its customer is.
 *
 * No leads-pool branch (unlike `customerVisibility`): the leads-pool predicate
 * (`derivedPipelineWhere(['leads'])`) correlates on the `customers` table, which
 * isn't joined into a `customer_notes` query — it wouldn't correlate. Dispatchers
 * don't edit notes anyway, so the branch is dropped rather than joined in.
 * see ../../customers/DOCS.md#note-authorship
 */
export function customerNoteVisibility({ userId }: VisibilityScope): SQL {
  return userCanSeeCustomer(userId, customerNotes.customerId)
}

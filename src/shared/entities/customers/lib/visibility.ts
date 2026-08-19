import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

/** see ../DOCS.md#visibility-via-meeting-participation and #derived-5-bucket-pipeline */
export function customerVisibility({ userId, ability }: VisibilityScope): SQL {
  // Dispatchers work the shared leads pool (derived 'leads' bucket = no meeting
  // yet) — a different predicate than agent participation-scoping, not a widening
  // of it. Same central derivation the dispatcher's CASL `$inDerivedPipeline`
  // rule emits, so the legacy and CASL paths agree. Non-empty set → never undefined.
  if (ability.can('read', 'LeadsPool')) {
    return derivedPipelineWhere(['leads'])!
  }
  return userCanSeeCustomer(userId, customers.id)
}

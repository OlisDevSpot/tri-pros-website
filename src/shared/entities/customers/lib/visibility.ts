import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

/**
 * @deprecated DEAD as of the Phase-7 engine migration (epic S7). The customer
 * CRUD factory leaf was flipped onto the CASL scope compiler
 * (`resolveTrpcActorScope`), so nothing resolves customer scope through the
 * legacy `resolveEffectiveScope`/`spec.visibility` path any more — this fn,
 * `userCanSeeCustomer`, and `customerServerSpec.visibility` are all orphaned.
 * Kept in place (not deleted) only because Phase 8 removes the whole legacy
 * read engine at once; delete it there. DO NOT wire anything new to it.
 *
 * ⚠️ Historical note: this branch emitted `['leads']` for dispatchers while the
 * CASL rule emits `['leads','rehash','dead','fresh']` — that divergence was the
 * dispatcher customer-edit bug the Phase-7 flip fixed. The old comment claiming
 * "the legacy and CASL paths agree" was false; the CASL path is now the only one.
 *
 * see ../DOCS.md#visibility-via-meeting-participation and #derived-5-bucket-pipeline
 */
export function customerVisibility({ userId, ability }: VisibilityScope): SQL {
  if (ability.can('read', 'LeadsPool')) {
    return derivedPipelineWhere(['leads'])!
  }
  return userCanSeeCustomer(userId, customers.id)
}

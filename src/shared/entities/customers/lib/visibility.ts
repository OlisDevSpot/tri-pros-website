import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

/**
 * @deprecated Being retired by the Phase-7 engine migration (epic S7). The
 * customer CRUD factory leaf was flipped onto the CASL compiler
 * (`resolveTrpcActorScope`, 7a-predecessor commit) — but this fn is NOT dead yet.
 *
 * ⚠️ STILL LIVE via the child-bridge path: `customer-notes` declares
 * `parent: customerServerSpec` and is STILL on the legacy factory, so every
 * customer-note read/mutation bridges through `resolveEffectiveScope(customerServerSpec)`
 * → here. This fn (and `userCanSeeCustomer` + `customerServerSpec.visibility`)
 * dies only when **customer-notes flips (Phase 7 unit 7b)**; the actual delete is
 * Phase 8 with the rest of the legacy engine. DO NOT wire anything new to it.
 *
 * Consequence until 7b: dispatcher note **update/delete** on a non-`leads`
 * customer still resolves the `['leads']` bridge below → not-found (note *create*
 * was already cut to CASL via `canAccess`). 7b closes this.
 *
 * ⚠️ Historical: the dispatcher branch emits `['leads']` while the CASL Customer
 * rule emits `['leads','rehash','dead','fresh']` — that divergence was the
 * dispatcher customer-edit bug the customer flip fixed. The old comment claiming
 * "the legacy and CASL paths agree" was false.
 *
 * see ../DOCS.md#visibility-via-meeting-participation and #derived-5-bucket-pipeline
 */
export function customerVisibility({ userId, ability }: VisibilityScope): SQL {
  if (ability.can('read', 'LeadsPool')) {
    return derivedPipelineWhere(['leads'])!
  }
  return userCanSeeCustomer(userId, customers.id)
}

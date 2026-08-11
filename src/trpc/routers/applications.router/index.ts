// Applications router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { draftRouter } from './draft.router'

export const applicationsRouter = createTRPCRouter({
  crud: crudRouter,
  business: businessRouter,
  draft: draftRouter,
})

// Customers router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { profileRouter } from './profile.router'

export const customersRouter = createTRPCRouter({
  crud: crudRouter,
  profile: profileRouter,
  business: businessRouter,
})

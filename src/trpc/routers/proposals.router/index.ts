// Proposals router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#pure-composition-index

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { contractsRouter } from './contracts.router'
import { crudRouter } from './crud.router'
import { deliveryRouter } from './delivery.router'
import { fundingRouter } from './funding.router'
import { incentivesRouter } from './incentives.router'
import { proposalMediaRouter } from './media.router'
import { viewsRouter } from './views.router'

export const proposalsRouter = createTRPCRouter({
  crud: crudRouter,
  business: businessRouter,
  incentives: incentivesRouter,
  funding: fundingRouter,
  delivery: deliveryRouter,
  views: viewsRouter,
  contracts: contractsRouter,
  media: proposalMediaRouter,
})

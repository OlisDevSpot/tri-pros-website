// Proposal module service — the ONE server-side API for proposal orchestration,
// shared by tRPC, route handlers, jobs and webhooks.
//
// Shape (the pattern every entity-bound service in the module follows — the
// "entity service" of Medusa's service factory / Feathers' standard-methods
// service / the NestJS generic-CRUD-service base class, done with object
// composition instead of inheritance):
//   ...<entity>Crud   the engine's five slots spread onto the service itself —
//                     getById · create · update · delete · duplicate — so any
//                     orchestrator can do plain CRUD on the entity with hooks firing
//   <slot override>   a slot redefined when the entity needs more than the engine
//                     does. None today: the proposal-COMPLETE duplicate (incentive
//                     rows cloned, rollup re-driven) is the `duplicate.after` hook
//                     in core/dal/server/crud.ts, so it fires for every caller.
//   <verbs>           orchestrations composing the slots with reads, peers and jobs
//   <children>        sub-entity services, each with the same shape, reached as
//                     `proposalService.views.record`, `proposalService.incentives.create`,
//                     `proposalService.media.delete`
//
// Why the children are getters: sub-module services reach their parent and
// siblings THROUGH this root (`proposalService.getById(...)` inside
// `incentives.replace`), which makes the import graph cyclic (root → incentives →
// root). ES module bindings are live, so a reference resolved at CALL time is
// always initialised — but a plain `incentives: proposalIncentivesService` here
// would read the child's binding while this literal is being evaluated, and
// whenever a child module is the first one loaded that binding is still in its
// temporal dead zone (ReferenceError at boot; proven in both import orders,
// 2026-09-10). A getter defers the read to first access.
//
// The rule this encodes for every `service.ts` in the module: reference an
// imported SERVICE only inside a method body (call time), never in a top-level
// property value. Top-level references — including the `...<entity>Crud` spread —
// are fine for DAL modules: the DAL never imports a service, so it is acyclic.
//
// Reads stay in the sub-module DALs (`<sub>/dal/server/queries.ts`); a service
// reads only when it must cross into a peer service or a provider.

import type { SpecCrudHandlers } from '@/shared/dal/server/types'

import type { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'

import { proposalIncentivesService } from './incentives/service'
import { proposalMediaService } from './media/service'
import { proposalViewsService } from './views/service'

export const proposalService = {
  ...proposalCrud,

  get incentives() {
    return proposalIncentivesService
  },
  get views() {
    return proposalViewsService
  },
  get media() {
    return proposalMediaService
  },
} satisfies SpecCrudHandlers<typeof proposalServerSpec>

export type ProposalService = typeof proposalService

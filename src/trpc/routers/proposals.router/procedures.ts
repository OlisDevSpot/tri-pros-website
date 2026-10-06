// Per-entity pre-scoped procedures for the proposals router — defined ONCE
// here as top-level consts (tRPC-idiomatic `const + typeof`), imported directly
// by every proposal sub-router. This replaces the old `createEntityRouter`
// factory + `EntityToolkit` argument: the middleware is baked on at definition
// time, not generated per call.
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.

import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'

import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'
import { shareableMiddleware } from '../../lib/middleware/shareable-middleware'

/** Agent-only. Session guaranteed; `ctx.scope` resolved from proposal visibility (null for omni). */
export const proposalProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalServerSpec, { userId: ctx.session.user.id, ability: ctx.actor.ability })
  return next({ ctx: { ...ctx, scope } })
})

/**
 * Agent-only, scoped to the proposal-media CHILD entity: `ctx.scope` is the
 * parent bridge `proposalId IN (SELECT proposals.id WHERE <proposal scope>)`
 * (null for omni). Drops into `proposalMediaCrud` / the shared media ops so a
 * media mutation is authorized in ONE query — no per-row probe.
 */
export const proposalMediaProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalMediaServerSpec, { userId: ctx.session.user.id, ability: ctx.actor.ability })
  return next({ ctx: { ...ctx, scope } })
})

/** Token-or-session. Token path → the holder's ability and `ctx.scope = eq(token, …)`. Session path → the request's actor and its row filter. */
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))

/** No auth. Pass-through of baseProcedure — the caller enforces authorization inline (e.g. manual token check). */
export const proposalPublicProcedure = baseProcedure

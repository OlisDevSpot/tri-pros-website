// Per-entity pre-scoped procedures for the meetings router — defined ONCE here
// as top-level consts, imported directly by every meeting sub-router. Replaces
// the old `createEntityRouter` factory + `EntityToolkit` argument: middleware is
// baked on at definition time, not generated per call.
// see ../../DOCS.md#entity-router-via-factory (being rewritten — epic S7)
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.
//
// The agent scope step is inlined (not `.use(scopeMiddleware(spec))`) so
// `ctx` is inferred from `agentProcedure` — the non-null session/ability
// narrowing flows through and no `as typeof agentProcedure` cast is needed.

import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from meeting visibility (null for omni). */
export const meetingProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(meetingServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

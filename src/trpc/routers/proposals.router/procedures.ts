// Per-entity pre-scoped procedures for the proposals router — defined ONCE
// here as top-level consts (tRPC-idiomatic `const + typeof`), imported directly
// by every proposal sub-router. This replaces the old `createEntityRouter`
// factory + `EntityToolkit` argument: the middleware is baked on at definition
// time, not generated per call. see ../../DOCS.md#entity-router-via-factory
// (being rewritten — epic S7)
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.
//
// Why the agent scope step is inlined (not `.use(scopeMiddleware(spec))`):
// the standalone `scopeMiddleware` is typed against the ROOT context, where
// `session` is nullable — chaining it would widen `ctx.session` back to null
// and force an `as typeof agentProcedure` cast (the old factory's crutch).
// An inline `.use()` infers `ctx` from `agentProcedure`, so the non-null
// session/ability narrowing flows through and no cast is needed. The scope
// math stays DRY via the shared `resolveVisibilityScope`.

import { proposalMediaServerSpec } from '@/shared/entities/proposal-media-files/lib/server-spec'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'
import { shareableMiddleware } from '../../lib/middleware/shareable-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from proposal visibility (null for omni). */
export const proposalProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

/**
 * Agent-only, scoped to the proposal-media CHILD entity: `ctx.scope` is the
 * parent bridge `proposalId IN (SELECT proposals.id WHERE <proposal scope>)`
 * (null for omni). Drops into `proposalMediaCrud` / the shared media ops so a
 * media mutation is authorized in ONE query — no per-row probe.
 */
export const proposalMediaProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalMediaServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

/** Token-or-session. Token path → `ctx.scope = eq(token, …)`, `ctx.ability = null`. Session path → normal scope. */
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))

/** No auth. Pass-through of baseProcedure — the caller enforces authorization inline (e.g. manual token check). */
export const proposalPublicProcedure = baseProcedure

// Per-entity pre-scoped procedures for the customers router — defined ONCE
// here as top-level consts (tRPC-idiomatic `const + typeof`), imported directly
// by every customer sub-router. This replaces the old `createEntityRouter`
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

import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from customer visibility (null for omni). */
export const customerProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(customerServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

/** No auth. Pass-through of baseProcedure — the public intake entrypoint enforces its own rate-limit + validation inline. */
export const customerPublicProcedure = baseProcedure

// ─── Scope Middleware ───────────────────────────────────────────────────────
// Middleware factory that resolves visibility scope for an entity.
// Omni users (CASL `manage all`) get `scope: null` — they see everything.
// Non-omni users get `scope: spec.visibility(userId)` — a Drizzle SQL fragment
// that DAL handlers apply to WHERE clauses.
//
// Uses `createMiddleware` (t.middleware) so tRPC natively tracks the ctx
// transformation — downstream procedures see `scope` on ctx without casts.
//
// Chain after agentProcedure (which guarantees session + ability non-null).

import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import { TRPCError } from '@trpc/server'

import { createMiddleware } from '@/trpc/init'

/**
 * Builds a scope-resolving middleware for the given entity spec.
 *
 * Reads `ctx.ability` + `ctx.session` (guaranteed non-null by agentProcedure)
 * and sets `ctx.scope` to the entity's visibility predicate, or `null` for
 * omni users.
 */
export function scopeMiddleware(spec: EntityServerSpec) {
  return createMiddleware(async ({ ctx, next }) => {
    // Runtime guard — agentProcedure already checked, but createMiddleware
    // types ctx from the base HTTPTRPCContext where these are nullable.
    // This narrows for TypeScript without adding runtime cost (guard never fires).
    if (!ctx.ability || !ctx.session) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'scopeMiddleware requires authed context' })
    }
    const isOmni = ctx.ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
    return next({ ctx: { ...ctx, scope } })
  })
}

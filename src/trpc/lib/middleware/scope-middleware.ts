// Scope-resolving middleware. see ../../DOCS.md#scope-middleware-is-the-core-superpower
// Chain after agentProcedure (which guarantees session + ability non-null).

import type { EntityServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'

import { createMiddleware } from '@/trpc/init'

/** Returns a middleware that sets `ctx.scope` from `spec.visibility(userId)` (or null for omni). */
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

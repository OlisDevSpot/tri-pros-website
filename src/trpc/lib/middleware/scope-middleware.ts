// Scope-resolving middleware. see ../../DOCS.md#scope-middleware-is-the-core-superpower
// Chain after agentProcedure (which guarantees session + ability non-null).

import type { SQL } from 'drizzle-orm'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { TRPCError } from '@trpc/server'

import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { createMiddleware } from '@/trpc/init'

/**
 * Pure scope resolver: `null` for omni (super-admin), else the entity's
 * EFFECTIVE visibility predicate (own fragment + parent bridge for
 * sub-entities). Omni lives here — a procedure/context concern — never inside
 * the entity's `visibility` fragment. Shared by both `scopeMiddleware` (used by
 * the legacy factory) and the per-entity `procedures.ts` inline chains so the
 * two can never drift. see ../../DOCS.md#scope-middleware-is-the-core-superpower
 */
export function resolveVisibilityScope(
  spec: EntityServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  const isOmni = auth.ability.can('manage', 'all')
  return isOmni ? null : resolveEffectiveScope(spec, { userId: auth.userId, ability: auth.ability })
}

/** Returns a middleware that sets `ctx.scope` from `spec.visibility({ userId, ability })` (or null for omni). */
export function scopeMiddleware(spec: EntityServerSpec) {
  return createMiddleware(async ({ ctx, next }) => {
    // Runtime guard — agentProcedure already checked, but createMiddleware
    // types ctx from the base HTTPTRPCContext where these are nullable.
    // This narrows for TypeScript without adding runtime cost (guard never fires).
    if (!ctx.ability || !ctx.session) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'scopeMiddleware requires authed context' })
    }
    const scope = resolveVisibilityScope(spec, { userId: ctx.session.user.id, ability: ctx.ability })
    return next({ ctx: { ...ctx, scope } })
  })
}

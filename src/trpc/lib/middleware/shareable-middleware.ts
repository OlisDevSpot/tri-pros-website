// Token-or-session dual-credential middleware. see ../../DOCS.md#shareable-middleware-token-or-session

import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'

import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { tokenActor, userActor } from '@/shared/domains/permissions/scope/actor'
import { createMiddleware } from '@/trpc/init'

/** Token path → eq(tokenColumn, token) + ability null. Session path → normal scope resolution. */
export function shareableMiddleware(spec: EntityServerSpec) {
  // Cast: Drizzle's PgTable type doesn't expose columns as a keyed record.
  // Dynamic column lookup by name (from spec.shareable.tokenColumn) requires
  // treating the table object as a record. No typed API exists for this.
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const tokenColumnName = spec.shareable?.tokenColumn
  const tokenColumn = tokenColumnName ? table[tokenColumnName] : undefined

  if (spec.shareable && !tokenColumn) {
    throw new Error(
      `[shareable-middleware] spec.shareable.tokenColumn '${tokenColumnName}' `
      + `is not a column on ${spec.entityName}'s table.`,
    )
  }

  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    // ── Session path (AGENT-FIRST) ─────────────────────────────────────────
    // An authenticated session ALWAYS wins: a token in the URL is IGNORED for a
    // logged-in user. This guarantees agent-always-user (never ability=null for
    // an authenticated agent, which would strip agent-only capabilities — e.g.
    // the envelope gate at contracts.router.ts) alongside homeowner-always-token
    // below. It is a tightening: a token no longer sideways-grants an authed
    // agent a row outside their own scope. see ../../DOCS.md#shareable-middleware-token-or-session
    if (ctx.session) {
      const ability = defineAbilitiesFor({
        id: ctx.session.user.id,
        role: ctx.session.user.role,
      })
      const isOmni = ability.can('manage', 'all')
      const scope = isOmni ? null : resolveEffectiveScope(spec, { userId: ctx.session.user.id, ability })
      const actor = userActor(ctx.session.user.id, ability)
      if (actor.kind !== 'user') {
        throw new Error('[shareable-middleware] session branch must yield a user actor')
      }
      return next({ ctx: { ...ctx, session: ctx.session, ability, scope, actor } })
    }

    // ── Token path (homeowner) ─────────────────────────────────────────────
    // No session — a valid token IS the authorization; the honest actor is a
    // tokenActor whose reach is exactly the token-matched row(s). This is the
    // token seam. Cast: tRPC v11's getRawInput() returns Promise<unknown> by
    // design — input hasn't been Zod-validated yet. We peek at the token field
    // before validation for the dual-credential branching decision.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined
    if (token && tokenColumn) {
      const scope = eq(tokenColumn, token)
      const actor = tokenActor(scope, spec.caslSubject)
      if (actor.kind !== 'token') {
        throw new Error('[shareable-middleware] token branch must yield a token actor')
      }
      return next({ ctx: { ...ctx, session: ctx.session, ability: null, scope, actor } })
    }

    // ── Neither ────────────────────────────────────────────────────────────
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'A valid token or authenticated session is required',
    })
  })
}

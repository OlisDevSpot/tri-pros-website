// Token-or-session dual-credential middleware. see ../../DOCS.md#shareable-middleware-token-or-session

import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
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
    // Cast: tRPC v11's getRawInput() returns Promise<unknown> by design —
    // input hasn't been Zod-validated yet. We peek at the token field before
    // validation for the dual-credential branching decision.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined

    // ── Token path ───────────────────────────────────────────────────────
    // Token IS authorization. No session/ability needed.
    if (token && tokenColumn) {
      return next({
        ctx: {
          ...ctx,
          session: ctx.session,
          ability: null,
          scope: eq(tokenColumn, token),
        },
      })
    }

    // ── Session path ─────────────────────────────────────────────────────
    // No token — require authenticated session.
    if (!ctx.session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'A valid token or authenticated session is required',
      })
    }

    const ability = defineAbilitiesFor({
      id: ctx.session.user.id,
      role: ctx.session.user.role,
    })

    const isOmni = ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        ability,
        scope,
      },
    })
  })
}

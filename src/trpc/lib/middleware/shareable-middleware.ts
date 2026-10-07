// Token-or-session dual-credential middleware.

import type { PgColumn } from 'drizzle-orm/pg-core'

import type { AnyServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'

import { subjectOf } from '@/shared/dal/server/lib/define-spec'
import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { createMiddleware } from '@/trpc/init'

/** Token path → the holder's ability and `scope = eq(tokenColumn, token)`. Session path → the request's actor and its row filter. */
export function shareableMiddleware(spec: AnyServerSpec) {
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

  // What a token allows today: read and update, on the row it names. `scope` pins the row.
  const bearerAbility = abilityFromRules([{ action: ['read', 'update'], subject: subjectOf(spec) }])

  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    // Cast: tRPC v11's getRawInput() returns Promise<unknown> by design —
    // input hasn't been Zod-validated yet. We peek at the token field before
    // validation for the dual-credential branching decision.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined

    // A token wins over a session: staff who open a share link act as its holder.
    if (token && tokenColumn) {
      return next({
        ctx: {
          ...ctx,
          actor: { ability: bearerAbility, userId: null },
          scope: eq(tokenColumn, token),
        },
      })
    }

    if (!ctx.session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'A valid token or authenticated session is required',
      })
    }

    const isOmni = ctx.actor.ability.can('manage', 'all')
    const scope = isOmni ? null : resolveEffectiveScope(spec, { userId: ctx.session.user.id, ability: ctx.actor.ability })

    return next({ ctx: { ...ctx, session: ctx.session, scope } })
  })
}

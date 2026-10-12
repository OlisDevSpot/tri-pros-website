import type { AnyServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'

import { bearerContext } from '@/shared/dal/server/lib/contexts'
import { createMiddleware } from '@/trpc/init'

/**
 * A session wins: staff who open a share link act as staff. Without one, the token must name a row,
 * and the request then holds only that row's share-link rules. A wrong token and a missing row answer the same.
 */
export function shareableMiddleware(spec: AnyServerSpec) {
  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    if (ctx.session) {
      return next({ ctx: { ...ctx, session: ctx.session } })
    }
    // Read before validation: which credential applies decides the context the input runs under.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = typeof rawInput?.token === 'string' ? rawInput.token : ''
    const bearer = token ? await bearerContext(spec, token) : null
    if (!bearer) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'A valid share link or a signed-in session is required' })
    }
    return next({ ctx: { ...ctx, actor: bearer.actor, scope: null } })
  })
}

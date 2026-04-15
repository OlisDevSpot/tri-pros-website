import type { BetterAuthSession } from '@/shared/domains/auth/server'
import { initTRPC, TRPCError } from '@trpc/server'
import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { auth } from '@/shared/domains/auth/server'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

export interface CoreTRPCContext {
  session: BetterAuthSession | null
}

export interface HTTPTRPCContext extends CoreTRPCContext {
  req?: Request
  resHeaders: Headers
}

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => {
  const reqHeaders = await getHeaders()

  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  return {
    session,
    req: ctx.req,
    resHeaders: ctx.resHeaders,
  }
})

const t = initTRPC.context<HTTPTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure

// ── protectedProcedure ────────────────────────────────────────────────────
// Any authenticated user. Use for endpoints that homeowners/default users
// might need in the future (e.g., viewing their own proposal).
// Attaches CASL ability to context so downstream handlers can do
// granular checks like `ctx.ability.can('read', 'Proposal')`.
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    })
  }

  const ability = defineAbilitiesFor({
    id: ctx.session.user.id,
    role: ctx.session.user.role,
  })

  return await next({
    ctx: { ...ctx, session: ctx.session, ability },
  })
})

// ── agentProcedure ────────────────────────────────────────────────────────
// Internal users only (agent, super-admin). This is the main guard for
// dashboard/CRM endpoints. Extends protectedProcedure, so session and
// ability are already on ctx.
//
// The CASL check `can('access', 'Dashboard')` is equivalent to checking
// if the user is agent or super-admin, but uses the centralized permission
// system instead of hardcoded role checks.
export const agentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.ability.cannot('access', 'Dashboard')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return await next({ ctx })
})

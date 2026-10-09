import type { HTTPTRPCContext } from '@/trpc/types'

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

export { createHTTPTRPCContext } from '@/trpc/lib/create-http-context'

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
export const createMiddleware = t.middleware
export const createCallerFactory = t.createCallerFactory

// Stands in for Next's dev request log, which next.config.ts filters out for
// /api/trpc because batch URLs carry their whole JSON input.
const devTiming = t.middleware(async ({ path, type, next }) => {
  const start = performance.now()
  const result = await next()
  // eslint-disable-next-line no-console
  console.log(` trpc ${type} ${path}${result.ok ? '' : ` ✗ ${result.error.code}`} in ${Math.round(performance.now() - start)}ms`)
  return result
})

// eslint-disable-next-line node/prefer-global/process
export const baseProcedure = process.env.NODE_ENV === 'production' ? t.procedure : t.procedure.use(devTiming)

// Any signed-in user. Narrows `session`; the actor was built once, with the context.
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    })
  }

  return await next({ ctx: { ...ctx, session: ctx.session } })
})

// Internal users: the guard for dashboard and CRM endpoints.
export const agentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('access', 'Dashboard')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return await next({ ctx })
})

// Super-admin only. Gate privileged, cross-source operations here, not with a role check in the handler.
export const superAdminProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('manage', 'all')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Super-admin access required.',
    })
  }

  return await next({ ctx })
})

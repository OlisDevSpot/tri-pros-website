import type { BetterAuthSession } from '@/shared/auth/server'
import { initTRPC, TRPCError } from '@trpc/server'
import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { auth } from '@/shared/auth/server'

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

export const agentProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Only authenticated users are allowed to perform this action',
    })
  }

  return await next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})

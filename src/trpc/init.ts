import config from '@payload-config'
import { initTRPC } from '@trpc/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'
import superjson from 'superjson'

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' }
})
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
})
// Base router and procedure helpers
export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure

export const payloadProcedure = t.procedure.use(async ({ ctx, next }) => {
  const payload = await getPayload({ config })

  return await next({
    ctx: {
      ...ctx,
      payload,
    },
  })
})

export const protectedProcedure = payloadProcedure.use(async ({ ctx, next }) => {
  const headers = await getHeaders()
  const session = await ctx.payload.auth({ headers })

  return await next({
    ctx: {
      ...ctx,
      session,
    },
  })
})

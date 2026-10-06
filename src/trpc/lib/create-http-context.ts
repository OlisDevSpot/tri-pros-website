import type { HTTPTRPCContext } from '@/trpc/types'

import { cache } from 'react'

import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => ({
  ...(await getRequestActor()),
  scope: null,
  req: ctx.req,
  resHeaders: ctx.resHeaders,
}))

// For server-component prefetching through the options proxy in `src/trpc/server.ts`. There is no
// adapter Request, so `req` stays undefined: a procedure that reads `ctx.req` must not be prefetched.
export const createRSCTRPCContext = cache(async (): Promise<HTTPTRPCContext> => ({
  ...(await getRequestActor()),
  scope: null,
  req: undefined,
  resHeaders: new Headers(),
}))

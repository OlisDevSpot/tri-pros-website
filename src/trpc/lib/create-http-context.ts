// ─── createHTTPTRPCContext ───────────────────────────────────────────────────
// Factory for the HTTP adapter context. Resolves the session from request
// headers; ability + scope start null (narrowed by procedure middleware).

import type { HTTPTRPCContext } from '@/trpc/types'

import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'

import { auth } from '@/shared/domains/auth/server'

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => {
  const reqHeaders = await getHeaders()

  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  return {
    session,
    ability: null,
    scope: null,
    req: ctx.req,
    resHeaders: ctx.resHeaders,
  }
})

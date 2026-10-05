// ─── createHTTPTRPCContext ───────────────────────────────────────────────────
// Factory for the HTTP adapter context. Resolves the session from request
// headers; ability + scope start null (narrowed by procedure middleware).

import type { HTTPTRPCContext } from '@/trpc/types'

import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'

import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'
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

// ─── createRSCTRPCContext ────────────────────────────────────────────────────
// Context for server-component prefetching via the options proxy in
// `src/trpc/server.ts`. It takes the session from getCachedSession, the
// request memo the dashboard layout and protectDashboardPage share, so a
// prefetching page reads the session once instead of twice in sequence
// before its first query starts. There is no adapter Request: `req` stays
// undefined, which is safe because shareable-token procedures pull `token`
// out of the procedure input via `getRawInput()` (shareable-middleware.ts),
// never `req`.
export const createRSCTRPCContext = cache(async (): Promise<HTTPTRPCContext> => ({
  session: await getCachedSession(),
  ability: null,
  scope: null,
  req: undefined,
  resHeaders: new Headers(),
}))

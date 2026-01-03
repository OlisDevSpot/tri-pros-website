import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { cache } from 'react'
import { auth } from '@/shared/auth/server'
import env from '@/shared/config/server-env'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/app'
import 'server-only' // <-- ensure this file cannot be imported from the client
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy({
  ctx: async () => {
    const session = await auth.api.getSession()
    const req = new Request(env.NEXT_PUBLIC_BASE_URL)

    return { session, req, setCookie: () => {}, resHeaders: new Headers() }
  },
  router: appRouter,
  queryClient: getQueryClient,
})

import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { cache } from 'react'
import { createRSCTRPCContext } from '@/trpc/lib/create-http-context'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/app'
import 'server-only' // <-- ensure this file cannot be imported from the client
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy({
  ctx: createRSCTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
})

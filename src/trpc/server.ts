import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { cache } from 'react'
import { createRSCTRPCContext } from '@/trpc/lib/create-http-context'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/app'
import 'server-only' 

export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy({
  ctx: createRSCTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
})

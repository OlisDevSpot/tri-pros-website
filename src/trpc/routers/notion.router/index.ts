import { revalidateTag } from 'next/cache'

import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { scopesRouter } from './scopes.router'
import { tradesRouter } from './trades.router'

export const notionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  revalidateNotionCache: agentProcedure.mutation(async () => {
    revalidateTag('notion-trades')
    revalidateTag('notion-scopes')
    revalidateTag('notion-pain-points')
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})

import { revalidateTag } from 'next/cache'

import { CONSTRUCTION_CATALOG_TAG } from '@/shared/modules/construction/service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { scopesRouter } from './scopes.router'
import { tradesRouter } from './trades.router'

export const notionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  revalidateNotionCache: agentProcedure.mutation(async () => {
    revalidateTag(CONSTRUCTION_CATALOG_TAG)
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})

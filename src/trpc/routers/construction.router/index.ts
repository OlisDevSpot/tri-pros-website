import { revalidateTag } from 'next/cache'

import { CONSTRUCTION_CATALOG_TAG } from '@/shared/modules/construction/service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { scopesRouter } from './scopes.router'
import { sowRouter } from './sow.router'
import { tradesRouter } from './trades.router'

export const constructionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  sow: sowRouter,

  /** One tag covers every cached catalog read — see modules/construction/DOCS.md#one-cache-tag */
  revalidateCatalog: agentProcedure.mutation(async () => {
    revalidateTag(CONSTRUCTION_CATALOG_TAG)
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})

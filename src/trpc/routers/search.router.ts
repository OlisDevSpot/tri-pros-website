import { omniSearchInputSchema } from '@/shared/domains/omni-search/schemas'
import { searchService } from '@/shared/services/search.service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const searchRouter = createTRPCRouter({
  omni: agentProcedure
    .input(omniSearchInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await searchService.omni(ctx, input))),
})

import z from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).scopes),

  /**
   * One trade's scopes. Replaced getScopesByQuery, whose `filterProperty`
   * input was a literal Notion property key. The per-trade query pattern
   * survives to P3 (F7); the Notion leak does not.
   */
  byTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const { scopes } = await constructionService.getCatalog()
      return scopes.filter(scope => scope.tradeId === input.tradeId)
    }),
})

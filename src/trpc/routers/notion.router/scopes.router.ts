import { TRPCError } from '@trpc/server'
import z from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).scopes),

  /**
   * One trade's scopes. Replaces getScopesByQuery, whose `filterProperty`
   * input was a literal Notion property key. The per-trade query pattern
   * survives to P3 (F7); the Notion leak does not.
   */
  byTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const { scopes } = await constructionService.getCatalog()
      return scopes.filter(scope => scope.tradeId === input.tradeId)
    }),

  getAllSOW: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowTemplatesByScope(input.scopeId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),

  getSOWContent: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowContent(input.sowId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),
})

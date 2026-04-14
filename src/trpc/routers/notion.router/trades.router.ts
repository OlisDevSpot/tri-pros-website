import z from 'zod'
import { constructionDataService } from '@/shared/services/construction-data.service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      return constructionDataService.getTrades()
    }),
  getTradesByQuery: baseProcedure
    .input(z.object({ query: z.string().optional().nullable() }))
    .query(async ({ input }) => {
      if (!input.query) {
        return constructionDataService.getTrades()
      }
      return constructionDataService.getTradesByQuery({ query: input.query })
    }),
})

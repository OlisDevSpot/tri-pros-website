import { constructionDataService } from '@/shared/services/construction-data.service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      return constructionDataService.getTrades()
    }),
})

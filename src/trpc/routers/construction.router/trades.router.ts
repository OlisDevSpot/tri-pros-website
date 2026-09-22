import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).trades),
})

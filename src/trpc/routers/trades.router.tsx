import { getAllTrades } from '@/shared/server/construction/trades/api'
import { baseProcedure, createTRPCRouter } from '../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      const allTrades = await getAllTrades()

      return allTrades
    }),
})

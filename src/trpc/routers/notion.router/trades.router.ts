import z from 'zod'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToTrade } from '@/shared/services/notion/lib/trades/adapter'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      const rawTrades = await queryNotionDatabase('trades', {
        sortBy: { property: 'name', direction: 'ascending' },
      })

      if (!rawTrades)
        return []

      const trades = rawTrades.map(pageToTrade)

      return trades
    }),
  getTradesByQuery: baseProcedure
    .input(z.object({ query: z.string().optional().nullable() }))
    .query(async ({ input }) => {
      const rawTrades = await queryNotionDatabase('trades', {
        query: input.query || undefined,
        filterProperty: 'name',
        sortBy: { property: 'name', direction: 'ascending' },
      })

      if (!rawTrades)
        return []

      const trades = rawTrades.map(pageToTrade)

      return trades
    }),
})

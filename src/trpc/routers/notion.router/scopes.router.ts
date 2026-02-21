import z from 'zod'
import { getTypedKeys } from '@/shared/lib/utils'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'
import { scopeOrAddonSchema } from '@/shared/services/notion/lib/scopes/schema'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      const rawTrades = await queryNotionDatabase('scopes')

      if (!rawTrades)
        return []

      const trades = rawTrades.map(pageToScope)

      return trades
    }),
  getScopesByQuery: baseProcedure
    .input(z.object({
      query: z.string().optional(),
      filterProperty: z.enum(getTypedKeys(scopeOrAddonSchema.omit({ id: true }).shape)).optional(),
      sortBy: z.enum(getTypedKeys(scopeOrAddonSchema.omit({ id: true }).shape)).optional(),
    }))
    .query(async ({ input }) => {
      const opts = input
      const rawScopes = await queryNotionDatabase('scopes', opts)
      if (!rawScopes)
        return []

      const scopes = rawScopes.map(pageToScope)

      return scopes
    }),
  getScopesByTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const { tradeId } = input

      const rawScopes = await queryNotionDatabase('scopes', { query: tradeId, filterProperty: 'relatedTrade' })
      if (!rawScopes)
        return []

      const scopes = rawScopes.map(pageToScope)

      return scopes
    }),
})

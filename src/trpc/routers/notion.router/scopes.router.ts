import type { PageObjectResponse } from '@notionhq/client'
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getTypedKeys } from '@/shared/lib/utils'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToTiptapJson } from '@/shared/services/notion/lib/page-to-tiptap-json'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'
import { scopeOrAddonSchema } from '@/shared/services/notion/lib/scopes/schema'
import { pageToSOW } from '@/shared/services/notion/lib/sows/adapter'
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
      sortBy: z.object({
        property: z.enum(getTypedKeys(scopeOrAddonSchema.omit({ id: true }).shape)),
        direction: z.enum(['ascending', 'descending']).optional().default('ascending'),
      }).optional(),
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
  getAllSOW: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      const { scopeId } = input

      try {
        const rawSOWs = await queryNotionDatabase('sows', { filterProperty: 'relatedScope', query: scopeId }) as PageObjectResponse[]
        if (!rawSOWs)
          throw new Error('Scope not found')

        const sows = rawSOWs.map(sow => pageToSOW(sow))

        return sows
      }
      catch (error: unknown) {
        if (error instanceof TRPCError) {
          console.error(error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error,
          })
        }
      }
    }),
  getSOWContent: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      const { sowId } = input

      try {
        // const html = await pageToHTML(sowId)
        const json = await pageToTiptapJson(sowId)

        return json
      }
      catch (error) {
        console.error(error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }
    }),
})

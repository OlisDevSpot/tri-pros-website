import type { PageObjectResponse } from '@notionhq/client'
import z from 'zod'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { pageToTrade } from '@/shared/services/notion/lib/trades/adapter'
import { baseProcedure, createTRPCRouter } from '../init'

export const notionRouter = createTRPCRouter({
  getContactByQuery: baseProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const { query } = input

      const notionContactPages = await queryNotionDatabase('contacts', query, { filterProperty: 'Name' }) as PageObjectResponse[]
      const firstNotionContactPage = notionContactPages[0]

      const resBody = {
        id: firstNotionContactPage.id,
        properties: pageToContact(firstNotionContactPage),
        allPages: notionContactPages,
      }

      return resBody
    }),
  getTradesByQuery: baseProcedure
    .input(z.object({ query: z.string().optional().nullable() }))
    .query(async ({ input }) => {
      const rawTrades = await queryNotionDatabase('trades', input.query ?? undefined, { sortBy: 'Trade' })

      const trades = rawTrades.map(pageToTrade)

      return trades
    }),
  // getScopesByQuery: baseProcedure
  //   .input(z.object({ query: z.string().optional().nullable() }))
  //   .query(async ({ input }) => {
  //     const rawScopes = await queryNotionDatabase('scopes', input.query ?? undefined, { sortBy: 'Scope' })

  //     const scopes = rawScopes.map(pageToScope)

  //     return scopes
  //   }),
})

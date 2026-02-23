import type { PageObjectResponse } from '@notionhq/client'
import z from 'zod'
import { getTypedKeys } from '@/shared/lib/utils'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { contactSchema } from '@/shared/services/notion/lib/contacts/schema'
import { baseProcedure, createTRPCRouter } from '../../init'

export const contactsRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      const rawTrades = await queryNotionDatabase('contacts')

      if (!rawTrades)
        return []

      const trades = rawTrades.map(pageToContact)

      return trades
    }),
  getSingleById: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const { id } = input

      const [contactPage] = await queryNotionDatabase('contacts', { id }) as PageObjectResponse[]
      if (!contactPage)
        return {}

      return pageToContact(contactPage)
    }),
  getByQuery: baseProcedure
    .input(z.object({
      id: z.string().optional(),
      query: z.string().optional(),
      filterProperty: z.enum(getTypedKeys(contactSchema.omit({ id: true }).shape)).optional(),
      sortBy: z.object({
        property: z.enum(getTypedKeys(contactSchema.omit({ id: true }).shape)),
        direction: z.enum(['ascending', 'descending']).optional().default('ascending'),
      }).optional(),
    }))
    .query(async ({ input }) => {
      const opts = input

      const notionContactPages = await queryNotionDatabase('contacts', opts) as PageObjectResponse[]
      const firstNotionContactPage = notionContactPages[0]

      try {
        const properties = pageToContact(firstNotionContactPage)
        const resBody = {
          id: firstNotionContactPage.id,
          properties,
          allPages: notionContactPages,
        }

        return resBody
      }
      catch (e) {
        console.error(e)
      }
    }),
})

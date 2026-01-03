import type { ContactResponse, ContactsResponse } from '@/shared/services/hubspot/types/contacts'
import z from 'zod'
import { getAccessToken } from '@/shared/auth/lib/get-access-token'
import env from '@/shared/config/server-env'
import { baseProcedure, createTRPCRouter } from '../init'

export const hubspotRouter = createTRPCRouter({
  test: baseProcedure.query(async () => {
    const { accessToken } = await getAccessToken() || { accessToken: '' }

    await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }),

  getContact: baseProcedure
    .input(z.object({ contactId: z.string() }))
    .query(async ({ input }) => {
      const { contactId } = input

      const { accessToken } = await getAccessToken() || { accessToken: '' }

      const properties = ['firstname', 'lastname', 'address', 'city', 'state', 'zip', 'phone', 'email'].join(',')

      const res = await fetch(`${env.HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contactId}?properties=${properties}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await res.json() as ContactResponse

      return data
    }),

  getContactByQuery: baseProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const { query } = input

      const { accessToken } = await getAccessToken() || { accessToken: '' }

      const res = await fetch(`${env.HUBSPOT_BASE_URL}/contacts/v1/search/query?q=${query}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await res.json() as ContactsResponse

      return data
    }),
})

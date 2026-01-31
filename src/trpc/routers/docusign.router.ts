import { TRPCError } from '@trpc/server'
import z from 'zod'
import env from '@/shared/config/server-env'
import { DS_REST_BASE_URL } from '@/shared/services/docusign/constants'
import { getAccessToken } from '@/shared/services/docusign/lib/get-access-token'
import { baseProcedure, createTRPCRouter } from '../init'

export const contractorTabs = {
  textTabs: {
    'start-date': '1/1/2026',
    'completion-date': '1/30/2026',
  },
  numericalTabs: {
    tcp: '50000',
    deposit: '1000',
  },
}

export const homeownerTabs = {
  textTabs: {
    'ho-address': '6252 Calvin Avenue',
    'ho-city-state-zip': 'Tarzana, CA 91335',
    'ho-phone': '(818) 470-7656',
  },
  numericalTabs: {
    'ho-age': '64',
  },
}

export const docusignRouter = createTRPCRouter({
  getAccessToken: baseProcedure.query(async () => {
    try {
      const data = await getAccessToken()

      return data
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.log(error)
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        cause: error,
      })
    }
  }),

  sendEnvelope: baseProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ input }) => {
      const { templateId } = input

      const token = await getAccessToken()

      if (typeof token === 'object' && token.error) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          cause: token.error,
        })
      }

      const body = {
        templateId,
        templateRoles: [
          {
            roleName: 'Contractor',
            tabs: {
              textTabs: Object.entries(contractorTabs.textTabs).map(([tabLabel, value]) => ({
                tabLabel,
                value,
              })),
              numericalTabs: Object.entries(contractorTabs.numericalTabs).map(([tabLabel, numericalValue]) => ({
                tabLabel,
                numericalValue,
              })),
            },
          },
          {
            roleName: 'Homeowner',
            name: 'Oliver P',
            email: 'poratofir@gmail.com',
            tabs: {
              textTabs: Object.entries(homeownerTabs.textTabs).map(([tabLabel, value]) => ({
                tabLabel,
                value,
              })),
              numberTabs: Object.entries(homeownerTabs.numericalTabs).map(([tabLabel, numericalValue]) => ({
                tabLabel,
                numericalValue,
              })),
            },
          },
        ],
        status: 'sent',
      }

      const res = await fetch(`${DS_REST_BASE_URL}/restapi/v2.1/accounts/${env.DS_ACCOUNT_ID}/envelopes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      console.log({ data })
      return data
    }),
})

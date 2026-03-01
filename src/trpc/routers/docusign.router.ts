import { TRPCError } from '@trpc/server'
import z from 'zod'
import env from '@/shared/config/server-env'
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { DS_REST_BASE_URL } from '@/shared/services/docusign/constants'
import { buildEnvelopeBody } from '@/shared/services/docusign/lib/build-envelope-body'
import { getAccessToken } from '@/shared/services/docusign/lib/get-access-token'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

async function getValidatedToken() {
  try {
    const token = await getAccessToken()

    return token as string
  }
  catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      cause: error,
    })
  }
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

  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const proposal = await getProposal(input.proposalId)

        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', cause: 'Proposal not found' })
        }

        const token = await getValidatedToken()

        const body = buildEnvelopeBody(proposal, 'created')

        const res = await fetch(`${DS_REST_BASE_URL}/restapi/v2.1/accounts/${env.DS_ACCOUNT_ID}/envelopes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        const data = await res.json() as { envelopeId?: string }

        if (!data.envelopeId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: data })
        }

        await updateProposal(proposal.ownerId, input.proposalId, {
          docusignEnvelopeId: data.envelopeId,
        })

        return { envelopeId: data.envelopeId }
      }
      catch (error) {
        // eslint-disable-next-line no-console
        console.log(error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }
    }),

  sendContractForSigning: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', cause: 'Invalid token' })
      }

      const accessToken = await getValidatedToken()

      let envelopeId = proposal.docusignEnvelopeId

      if (envelopeId) {
        // Draft exists — transition to sent
        await fetch(`${DS_REST_BASE_URL}/restapi/v2.1/accounts/${env.DS_ACCOUNT_ID}/envelopes/${envelopeId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'sent' }),
        })
      }
      else {
        // No draft — create and send in one step
        const body = buildEnvelopeBody(proposal, 'sent')

        const res = await fetch(`${DS_REST_BASE_URL}/restapi/v2.1/accounts/${env.DS_ACCOUNT_ID}/envelopes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        const data = await res.json() as { envelopeId?: string }

        if (!data.envelopeId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: data })
        }

        envelopeId = data.envelopeId
      }

      await updateProposal(input.token, input.proposalId, {
        docusignEnvelopeId: envelopeId,
        contractSentAt: new Date().toISOString(),
      })

      return { envelopeId }
    }),
})

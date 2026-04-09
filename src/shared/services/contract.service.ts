import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

function createContractService() {
  async function makeRequest(path: string, options: RequestInit) {
    const token = await getZohoAccessToken()
    return fetch(`${ZOHO_SIGN_BASE_URL}/api/v1${path}`, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  return {
    createSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      const { templateId, body } = buildSigningRequest(proposal)

      const res = await makeRequest(
        `/templates/${templateId}/createdocument`,
        { method: 'POST', body: JSON.stringify(body) },
      )

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign create document failed: ${errorText}`)
      }

      const data = await res.json() as ZohoCreateDocResponse
      const requestId = data.requests.request_id

      if (!requestId) {
        throw new Error('Zoho Sign returned no request_id')
      }

      await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
      return { requestId }
    },

    sendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      // Create draft if one doesn't exist yet
      if (!requestId) {
        const { templateId, body } = buildSigningRequest(proposal)
        const createRes = await makeRequest(
          `/templates/${templateId}/createdocument`,
          { method: 'POST', body: JSON.stringify(body) },
        )
        if (!createRes.ok) {
          const errorText = await createRes.text()
          throw new Error(`Zoho Sign create document failed: ${errorText}`)
        }
        const createData = await createRes.json() as ZohoCreateDocResponse
        requestId = createData.requests.request_id
      }

      // Submit the draft for signing
      const submitRes = await makeRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: requestId,
        contractSentAt: new Date().toISOString(),
      })

      return { requestId }
    },

    getSigningStatus: async (requestId: string) => {
      const res = await makeRequest(`/requests/${requestId}`, { method: 'GET' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign status check failed for ${requestId}: ${errorText}`)
      }
      const data = await res.json() as { requests: { request_status: string } }
      return { status: data.requests.request_status }
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()

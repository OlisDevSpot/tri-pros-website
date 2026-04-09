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

      // Recall any existing request so we always send with current proposal data
      if (proposal.signingRequestId) {
        await makeRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
          .catch(() => {}) // Ignore recall errors (request may already be completed/recalled)
      }

      // Create fresh document with current proposal data
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
      const requestId = createData.requests.request_id

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: requestId,
        contractSentAt: new Date().toISOString(),
      })

      return { requestId }
    },

    recallSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no signing request to recall`)
      }

      const res = await makeRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }

      // Clear the signing request ID so a new one can be created
      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      return { recalled: true }
    },

    resendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // If there's an existing request, recall it first
      if (proposal.signingRequestId) {
        await makeRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
      }

      // Create fresh document with current proposal data + send immediately
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
      const requestId = createData.requests.request_id

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

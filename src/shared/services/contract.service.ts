import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import type { ZohoActionStatus, ZohoContractStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

function createContractService() {
  async function getAuthHeader() {
    const token = await getZohoAccessToken()
    return { Authorization: `Zoho-oauthtoken ${token}` }
  }

  /** Standard JSON request for non-template endpoints (recall, submit, get status) */
  async function jsonRequest(path: string, options: RequestInit = {}) {
    const auth = await getAuthHeader()
    return fetch(`${ZOHO_SIGN_BASE_URL}/api/v1${path}`, {
      ...options,
      headers: {
        ...auth,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  /** Template endpoint uses form-encoded data={json} with is_quicksend as query param */
  async function createFromTemplate(templateId: string, body: object, quickSend: boolean) {
    const auth = await getAuthHeader()
    const qs = `is_quicksend=${quickSend}`

    return fetch(
      `${ZOHO_SIGN_BASE_URL}/api/v1/templates/${templateId}/createdocument?${qs}`,
      {
        method: 'POST',
        headers: { ...auth },
        body: `data=${encodeURIComponent(JSON.stringify(body))}`,
      },
    )
  }

  async function createDraft(proposalId: string, ownerKey: string | null) {
    const proposal = await getProposal(proposalId)
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    const { templateId, body } = buildSigningRequest(proposal)

    const res = await createFromTemplate(templateId, body, false)

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Zoho Sign create draft failed: ${errorText}`)
    }

    const data = await res.json() as ZohoCreateDocResponse
    const requestId = data.requests.request_id

    if (!requestId) {
      throw new Error('Zoho Sign returned no request_id')
    }

    await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
    return { requestId, status: data.requests.request_status }
  }

  return {
    /** Creates a draft signing request (not sent to signers). 0 credits if truly draft. */
    createSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // If a signing request already exists, return it
      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      return createDraft(proposalId, ownerKey)
    },

    /** Submits an existing draft for signing. Creates a fresh draft first if none exists. */
    sendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      // Create draft if one doesn't exist yet
      if (!requestId) {
        const result = await createDraft(proposalId, ownerKey)
        requestId = result.requestId
      }

      // Submit the draft for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
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

    /** Recalls (cancels) an in-progress signing request. Clears signingRequestId. */
    recallSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no signing request to recall`)
      }

      const res = await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      return { recalled: true }
    },

    /** Recalls existing request (if any), creates a fresh draft with current data, and submits it. */
    resendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // Recall existing request if present
      if (proposal.signingRequestId) {
        await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
          .catch(() => {}) // Ignore recall errors (may already be completed/recalled)
      }

      // Clear old reference
      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      // Create fresh draft with current proposal data
      const { requestId } = await createDraft(proposalId, ownerKey)

      // Submit for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
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

    getSigningStatus: async (requestId: string): Promise<ZohoContractStatus> => {
      const res = await jsonRequest(`/requests/${requestId}`, { method: 'GET' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign status check failed for ${requestId}: ${errorText}`)
      }

      const data = await res.json() as {
        requests: {
          request_id: string
          request_status: string
          actions: {
            role: string
            action_status: string
            recipient_email: string
          }[]
        }
      }

      const req = data.requests

      return {
        requestId: req.request_id,
        requestStatus: req.request_status as ZohoRequestStatus,
        signerStatuses: req.actions.map(a => ({
          role: a.role,
          status: a.action_status as ZohoActionStatus,
          recipientEmail: a.recipient_email,
        })),
      }
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()

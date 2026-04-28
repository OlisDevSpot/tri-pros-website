import type { Buffer } from 'node:buffer'
import type { ZohoActionStatus, ZohoContractStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { pdfService } from '@/shared/services/pdf.service'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import { isLongSow } from '@/shared/services/zoho-sign/lib/is-long-sow'

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
        headers: {
          ...auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(JSON.stringify(body))}`,
      },
    )
  }

  /** Deletes a draft or recalls+deletes an in-progress request. Zoho uses PUT, not DELETE. */
  async function deleteRequest(requestId: string) {
    const res = await jsonRequest(`/requests/${requestId}/delete`, {
      method: 'PUT',
      body: JSON.stringify({ recall_inprogress: true }),
    })
    return res.ok
  }

  /**
   * Attaches one or more files to an existing draft signing request.
   * Zoho requires the `requests` wrapper in the multipart `data` field;
   * an empty inner object means "keep the existing request metadata as-is,
   * just add the file(s)". Confirmed via live test on 2026-04-23.
   * See spec §6.5.
   */
  async function addFilesToRequest(requestId: string, files: Array<{ name: string, buffer: Buffer, mime: string }>): Promise<void> {
    const auth = await getAuthHeader()
    const form = new FormData()
    form.append('data', JSON.stringify({ requests: {} }))
    for (const f of files) {
      form.append('file', new Blob([new Uint8Array(f.buffer)], { type: f.mime }), f.name)
    }
    const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
      method: 'PUT',
      headers: auth, // no explicit Content-Type; FormData sets multipart boundary
      body: form,
    })
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Zoho addFilesToRequest failed (${res.status}): ${errorText}`)
    }
  }

  function sanitizeFilename(name: string): string {
    return name
      .replace(/[\\/]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 200)
  }

  async function parseDraftResponse(res: Response): Promise<{ requestId: string, status: string }> {
    if (!res.ok) {
      throw new Error(`Zoho Sign create draft failed: ${await res.text()}`)
    }
    const data = await res.json() as ZohoCreateDocResponse
    const requestId = data.requests.request_id
    if (!requestId) {
      throw new Error('Zoho Sign returned no request_id')
    }
    return { requestId, status: data.requests.request_status }
  }

  /**
   * Creates a Zoho Sign draft for a proposal. Branches on SOW length:
   * - short path: single template call, sow-1/sow-2 populated by the packer
   * - long path: generate SOW PDF → create template draft with pointer text
   *              in sow-1 → attach PDF via addFilesToRequest → save request ID
   */
  async function createDraft(proposalId: string, ownerKey: string | null) {
    const proposal = await getProposal(proposalId)
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    // Decide path BEFORE building the request — buildSigningRequest in long
    // mode requires sowPages, which we only know after generating the PDF.
    const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])

    if (!isLongSow(sowText)) {
      const { templateId, body } = buildSigningRequest(proposal, { mode: 'short' })
      const res = await createFromTemplate(templateId, body, false)
      const { requestId, status } = await parseDraftResponse(res)
      await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
      return { requestId, status }
    }

    // Long path: generate SOW PDF first, then build the request with accurate page count.
    const pdfBuffer = await pdfService.generateSowPdf({ proposalId })
    const sowPages = await countPdfPages(pdfBuffer)
    const { templateId, body } = buildSigningRequest(proposal, { mode: 'long', sowPages })

    const createRes = await createFromTemplate(templateId, body, false)
    const { requestId, status } = await parseDraftResponse(createRes)

    try {
      await addFilesToRequest(requestId, [{
        name: sanitizeFilename(`scope-of-work-${proposal.label || proposalId}.pdf`),
        buffer: pdfBuffer,
        mime: 'application/pdf',
      }])
    }
    catch (attachErr) {
      // Draft exists but attachment failed — clean up so next retry doesn't inherit a half-built envelope.
      await deleteRequest(requestId).catch(() => {})
      throw attachErr
    }

    await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
    return { requestId, status }
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

    /**
     * Ensures the Zoho Sign draft reflects current proposal data.
     * Deletes the existing request (draft or in-progress) and creates a fresh draft.
     * Drafts are free (0 credits), so delete + recreate is the cheapest sync strategy.
     */
    ensureDraftSynced: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // No existing request — just create
      if (!proposal.signingRequestId) {
        return createDraft(proposalId, ownerKey)
      }

      // Delete old request (works for drafts and in-progress), ignore errors
      await deleteRequest(proposal.signingRequestId).catch(() => {})

      // Clear stale reference
      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      // Create fresh draft with current proposal data
      return createDraft(proposalId, ownerKey)
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

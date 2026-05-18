import type { Buffer } from 'node:buffer'
import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/lib/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import type { ZohoContractStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { getBySigningRequestId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import { pdfService } from '@/shared/services/pdf.service'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { assembleEnvelope } from '@/shared/services/zoho-sign/documents/assemble-envelope'
import { buildProposalContext } from '@/shared/services/zoho-sign/documents/proposal-context'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { dedupeSignerStatuses } from '@/shared/services/zoho-sign/lib/dedupe-signer-statuses'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

function createContractService() {
  const handlers = createCrudDal(proposalServerSpec)

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
   * Creates a Zoho Sign draft for a proposal. Two code paths:
   *
   * - **Registry path** (when `formMetaJSON.envelopeDocumentIds` is set):
   *   builds a ProposalContext, validates the agent's selection against
   *   the scenario rules, calls `assembleEnvelope` which posts to
   *   `/templates/mergesend` (multi-template envelope) and attaches any
   *   generated PDFs. The envelope's document set comes from the
   *   registry; recipient/field unification is automatic via Zoho.
   *
   * - **Legacy path** (when the proposal has no `envelopeDocumentIds`):
   *   the pre-Phase-4 flow — single-template `createdocument` against
   *   base or senior tpr-HI plus an attached SOW PDF. Kept for in-flight
   *   proposals created before the agent UI shipped; they pass through
   *   without breaking. New proposals (post-Phase-5) will always carry
   *   an `envelopeDocumentIds` selection and use the registry path.
   *
   * Both paths always generate a SOW PDF — the legacy templates were
   * trimmed in Zoho (sow-1/sow-2 fields removed), so SOW content lives
   * exclusively in the attached PDF on this path. See the design plan
   * (.claude/plans/i-just-confirmed-harmonic-pinwheel.md) for the full
   * migration shape.
   */
  async function createDraft(ctx: ScopedContext, proposalId: string) {
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    const selection = proposal.formMetaJSON.envelopeDocumentIds ?? []
    if (selection.length > 0) {
      const proposalCtx = buildProposalContext(proposal)
      const { requestId, status } = await assembleEnvelope(proposalCtx)
      dalVerifySuccess(await handlers.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
      return { requestId, status }
    }

    // Legacy path: pre-Phase-5 proposals without an envelope-document selection.
    const pdfBuffer = await pdfService.generateSowPdf(ctx, { proposalId })
    const sowPages = await countPdfPages(pdfBuffer)
    const { templateId, body } = buildSigningRequest(proposal, { sowPages })

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

    dalVerifySuccess(await handlers.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
    return { requestId, status }
  }

  return {
    /** Creates a draft signing request (not sent to signers). 0 credits if truly draft. */
    createSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // If a signing request already exists, return it
      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      return createDraft(ctx, proposalId)
    },

    /** Submits an existing draft for signing. Creates a fresh draft first if none exists. */
    sendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      // Create draft if one doesn't exist yet
      if (!requestId) {
        const result = await createDraft(ctx, proposalId)
        requestId = result.requestId
      }

      // Submit the draft for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },

    /** Recalls (cancels) an in-progress signing request. Clears signingRequestId. */
    recallSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
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

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      return { recalled: true }
    },

    /** Recalls existing request (if any), creates a fresh draft with current data, and submits it. */
    resendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // Recall existing request if present
      if (proposal.signingRequestId) {
        await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
          .catch(() => {}) // Ignore recall errors (may already be completed/recalled)
      }

      // Clear old reference
      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      // Create fresh draft with current proposal data
      const { requestId } = await createDraft(ctx, proposalId)

      // Submit for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },

    /**
     * Ensures the Zoho Sign draft reflects current proposal data.
     * Deletes the existing request (draft or in-progress) and creates a fresh draft.
     * Drafts are free (0 credits), so delete + recreate is the cheapest sync strategy.
     */
    ensureDraftSynced: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // No existing request — just create
      if (!proposal.signingRequestId) {
        return createDraft(ctx, proposalId)
      }

      // Delete old request (works for drafts and in-progress), ignore errors
      await deleteRequest(proposal.signingRequestId).catch(() => {})

      // Clear stale reference
      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      // Create fresh draft with current proposal data
      return createDraft(ctx, proposalId)
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
          }[]
        }
      }

      const req = data.requests

      return {
        requestId: req.request_id,
        requestStatus: req.request_status as ZohoRequestStatus,
        signerStatuses: dedupeSignerStatuses(req.actions),
      }
    },

    /**
     * Applies a contract-signing event (from Zoho webhook) to the matching
     * proposal. Handles event->column mapping, idempotency, and auto-approve.
     * Returns the updated proposal, or undefined when no-op.
     */
    applyContractEvent: async (ctx: ScopedContext, input: {
      signingRequestId: string
      event: ContractEvent
      performedAt: string
    }) => {
      const { signingRequestId, event, performedAt } = input

      // 1. Find proposal by signingRequestId
      const proposal = dalVerifySuccess(await getBySigningRequestId(ctx, { signingRequestId }))
      if (!proposal) return undefined

      // 2. Idempotency check
      const column = contractEventColumn[event]
      const policy = contractEventIdempotencyPolicy[event]
      const existingValue = proposal[column as keyof typeof proposal] as string | null
      if (policy === 'write-once' && existingValue !== null) return undefined
      if (policy === 'earliest-wins' && existingValue !== null && existingValue <= performedAt) return undefined

      // 3. Build update payload
      const setFields: Partial<InsertProposalSchema> = { [column]: performedAt }
      if (shouldAutoApproveOnContractEvent(event)) {
        setFields.status = 'approved'
        if (!proposal.approvedAt) {
          setFields.approvedAt = performedAt
        }
      }

      // 4. Update via generic CRUD
      return dalVerifySuccess(await handlers.update(ctx, { id: proposal.id, data: setFields }))
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()

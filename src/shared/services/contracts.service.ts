import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getBySigningRequestId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { countPdfPages } from '@/shared/lib/pdf/count-pdf-pages'
import { pdfService } from '@/shared/services/pdf.service'
import { buildSigningRequest } from '@/shared/services/providers/zoho-sign/lib/build-signing-request'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'
import { zohoSyncService } from '@/shared/services/zoho-sync.service'

function createContractService() {
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
      const { requestId, status } = await zohoSyncService.createEnvelope(proposalCtx)
      dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
      return { requestId, status }
    }

    // Legacy path: pre-Phase-5 proposals without an envelope-document selection.
    const pdfBuffer = await pdfService.generateSowPdf(ctx, { proposalId })
    const sowPages = await countPdfPages(pdfBuffer)
    const { templateId, body } = buildSigningRequest(proposal, { sowPages })

    const { requestId, status } = await zohoSyncService.createLegacyDraft(templateId, body, [{
      name: zohoSyncService.sanitizeFilename(`scope-of-work-${proposal.label || proposalId}.pdf`),
      buffer: pdfBuffer,
      mime: 'application/pdf',
    }])

    dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
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
      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
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

      await zohoSyncService.recallRequest(proposal.signingRequestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
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
        await zohoSyncService.recallRequestSilent(proposal.signingRequestId)
      }

      // Clear old reference
      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      // Create fresh draft with current proposal data
      const { requestId } = await createDraft(ctx, proposalId)

      // Submit for signing
      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
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
      await zohoSyncService.deleteRequestSilent(proposal.signingRequestId)

      // Clear stale reference
      dalVerifySuccess(await proposalCrud.update(ctx, {
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
      return zohoSyncService.getRequestStatus(requestId)
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
      if (!proposal)
        return undefined

      // 2. Idempotency check
      const column = contractEventColumn[event]
      const policy = contractEventIdempotencyPolicy[event]
      const existingValue = proposal[column as keyof typeof proposal] as string | null
      if (policy === 'write-once' && existingValue !== null)
        return undefined
      if (policy === 'earliest-wins' && existingValue !== null && existingValue <= performedAt)
        return undefined

      // 3. Build update payload
      const setFields: Partial<InsertProposalSchema> = { [column]: performedAt }
      if (shouldAutoApproveOnContractEvent(event)) {
        setFields.status = 'approved'
        if (!proposal.approvedAt) {
          setFields.approvedAt = performedAt
        }
      }

      // 4. Update via generic CRUD
      return dalVerifySuccess(await proposalCrud.update(ctx, { id: proposal.id, data: setFields }))
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()

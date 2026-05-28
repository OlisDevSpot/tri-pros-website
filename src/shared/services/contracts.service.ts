import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getBySigningRequestId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'
import { zohoSyncService } from '@/shared/services/zoho-sync.service'

function createContractService() {
  /**
   * Creates a Zoho Sign draft envelope via the kind-aware registry path.
   * `assembleEnvelope` self-heals against context drift — required docs
   * are evaluated live from `evaluateDocuments(ctx)`, so an empty or stale
   * `envelopeDocumentIds` still produces the correct envelope.
   * see `docs/adr/0004-proposal-contract-independence.md`
   */
  async function createDraft(ctx: ScopedContext, proposalId: string) {
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    const proposalCtx = buildProposalContext(proposal)
    const { requestId, status } = await zohoSyncService.createEnvelope(proposalCtx)
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

    /**
     * Submits an EXISTING draft for signing. Strict — throws if the proposal
     * has no `signingRequestId`. Auto-create on missing draft is deliberately
     * NOT supported: it caused a two-tab race where Tab B silently created a
     * new envelope after Tab A discarded the draft, sending a contract the
     * agent never reviewed.
     */
    sendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      const requestId = proposal.signingRequestId
      if (!requestId) {
        throw new Error('No draft envelope exists for this proposal. Refresh the page and create a new draft before sending.')
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

    /**
     * Discards a draft signing request. Drafts cannot be recalled in Zoho
     * (POST /requests/{id}/recall returns 1015) — they must be deleted via
     * PUT /requests/{id}/delete. Clears signingRequestId so a fresh draft
     * can be created.
     */
    discardDraftRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no draft to discard`)
      }

      const ok = await zohoSyncService.deleteRequest(proposal.signingRequestId)
      if (!ok) {
        throw new Error(`Zoho Sign delete failed for request ${proposal.signingRequestId}`)
      }

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      return { discarded: true }
    },

    /** Recalls existing request (if any), creates a fresh draft, and submits it. */
    resendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        await zohoSyncService.recallRequestSilent(proposal.signingRequestId)
      }

      // createDraft installs the new signingRequestId — no need to clear first.
      const { requestId } = await createDraft(ctx, proposalId)

      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: { contractSentAt: new Date().toISOString() },
      }))

      return { requestId }
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

import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getByContractEnvelopeId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
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
    dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { contractEnvelopeId: requestId } }))
    return { requestId, status }
  }

  return {
    /** Creates a draft contract envelope (not sent to signers). 0 credits if truly draft. */
    createContractEnvelope: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // If a contract envelope already exists, return it
      if (proposal.contractEnvelopeId) {
        return { requestId: proposal.contractEnvelopeId }
      }

      return createDraft(ctx, proposalId)
    },

    /**
     * Submits an EXISTING draft for signing. Strict — throws if the proposal
     * has no `contractEnvelopeId`. Auto-create on missing draft is deliberately
     * NOT supported: it caused a two-tab race where Tab B silently created a
     * new envelope after Tab A discarded the draft, sending a contract the
     * agent never reviewed.
     *
     * The draft is submitted as-is, never rebuilt: the proposal lock ladder
     * (see `entities/proposals/lib/proposal-lock.ts`) guarantees content
     * cannot change while a draft exists — the sanctioned edit path discards
     * the draft first — so an existing draft is fresh by construction.
     */
    sendContractEnvelope: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      const requestId = proposal.contractEnvelopeId
      if (!requestId) {
        throw new Error('No draft envelope exists for this proposal. Refresh the page and create a new draft before sending.')
      }
      if (proposal.contractSentAt) {
        throw new Error('Contract already sent for signing. Use resend to issue a fresh envelope.')
      }

      // Submit the draft for signing
      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: { contractSentAt: new Date().toISOString() },
      }))

      return { requestId }
    },

    /** Recalls (cancels) an in-progress contract envelope. Clears contractEnvelopeId. */
    recallContractEnvelope: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.contractEnvelopeId) {
        throw new Error(`Proposal ${proposalId} has no contract envelope to recall`)
      }

      await zohoSyncService.recallRequest(proposal.contractEnvelopeId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          contractEnvelopeId: null,
          contractSentAt: null,
        },
      }))

      return { recalled: true }
    },

    /**
     * Discards a draft contract envelope. Drafts cannot be recalled in Zoho
     * (POST /requests/{id}/recall returns 1015) — they must be deleted via
     * PUT /requests/{id}/delete. Clears contractEnvelopeId so a fresh draft
     * can be created.
     */
    discardContractEnvelopeDraft: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.contractEnvelopeId) {
        throw new Error(`Proposal ${proposalId} has no draft to discard`)
      }

      const ok = await zohoSyncService.deleteRequest(proposal.contractEnvelopeId)
      if (!ok) {
        throw new Error(`Zoho Sign delete failed for request ${proposal.contractEnvelopeId}`)
      }

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          contractEnvelopeId: null,
          contractSentAt: null,
        },
      }))

      return { discarded: true }
    },

    /** Recalls existing request (if any), creates a fresh draft, and submits it. */
    resendContractEnvelope: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.contractEnvelopeId) {
        await zohoSyncService.recallRequestSilent(proposal.contractEnvelopeId)
      }

      // createDraft installs the new contractEnvelopeId — no need to clear first.
      const { requestId } = await createDraft(ctx, proposalId)

      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: { contractSentAt: new Date().toISOString() },
      }))

      return { requestId }
    },

    getContractEnvelopeStatus: async (requestId: string): Promise<ZohoContractStatus> => {
      return zohoSyncService.getRequestStatus(requestId)
    },

    /**
     * Applies a contract-signing event (from Zoho webhook) to the matching
     * proposal. Handles event->column mapping, idempotency, and auto-approve.
     * Returns the updated proposal, or undefined when no-op.
     */
    applyContractEvent: async (ctx: ScopedContext, input: {
      contractEnvelopeId: string
      event: ContractEvent
      performedAt: string
    }) => {
      const { contractEnvelopeId, event, performedAt } = input

      // 1. Find proposal by contractEnvelopeId
      const proposal = dalVerifySuccess(await getByContractEnvelopeId(ctx, { contractEnvelopeId }))
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

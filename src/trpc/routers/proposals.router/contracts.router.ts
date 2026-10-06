import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { contractService } from '@/shared/services/contracts.service'
import { EnvelopeSelectionError, evaluateDocuments, projectAgreementDocs, reconcileEnvelopeSelection, validateEnvelopeSelection } from '@/shared/services/providers/zoho-sign/lib/documents/evaluate'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure, proposalShareableProcedure } from './procedures'

export const contractsRouter = createTRPCRouter({
  getContractStatus: proposalShareableProcedure
    .input(z.object({ id: z.string(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const proposal = dalToTrpc(await getFullView(ctx, input))

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      if (!proposal.contractEnvelopeId) {
        return null
      }

      const stamps = {
        contractSentAt: proposal.contractSentAt,
        contractViewedAt: proposal.contractViewedAt,
        contractSignedAt: proposal.contractSignedAt,
        contractDeclinedAt: proposal.contractDeclinedAt,
      }

      // The webhook is the source of truth for terminal state — no live Zoho call once completion or decline is persisted.
      if (proposal.contractSignedAt) {
        return { requestId: proposal.contractEnvelopeId, requestStatus: 'completed' as const, signerStatuses: [], ...stamps }
      }
      if (proposal.contractDeclinedAt) {
        return { requestId: proposal.contractEnvelopeId, requestStatus: 'declined' as const, signerStatuses: [], ...stamps }
      }

      try {
        const status = await contractService.getContractEnvelopeStatus(proposal.contractEnvelopeId)
        return { ...status, ...stamps }
      }
      catch {
        return null
      }
    }),

  createContractDraft: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.createContractEnvelope(ctx, input.proposalId)
    }),

  submitContract: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.sendContractEnvelope(ctx, input.proposalId)
    }),

  recallContract: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.recallContractEnvelope(ctx, input.proposalId)
    }),

  /** Zoho drafts can't be recalled — they must be deleted via `PUT /requests/{id}/delete`; `recallContract` is for in-flight envelopes only. */
  discardDraftContract: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.discardContractEnvelopeDraft(ctx, input.proposalId)
    }),

  resendContract: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.resendContractEnvelope(ctx, input.proposalId)
    }),

  /** Shareable so the homeowner-side first-time form renders the same evaluation. */
  evaluateEnvelopeContext: proposalShareableProcedure
    .input(z.object({ id: z.string(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const proposal = dalToTrpc(await getFullView(ctx, input))
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (!proposal.customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
      }

      const customerAge = proposal.customer.customerAge ?? null
      const savedSelection = proposal.envelopeDocumentIds ?? []

      // Registry rules depend on age; an empty docs list makes the UI prompt for it first.
      if (customerAge == null) {
        return {
          customerAge: null,
          envelopeDocumentIds: savedSelection,
          kind: proposal.kind,
          docs: [],
        }
      }

      const proposalCtx = buildProposalContext(proposal)
      const evaluation = evaluateDocuments(proposalCtx)

      return {
        customerAge,
        envelopeDocumentIds: savedSelection,
        kind: proposalCtx.kind,
        docs: projectAgreementDocs(evaluation),
      }
    }),

  /**
   * Shareable so the homeowner can submit their own age via the proposal token, but
   * `envelopeDocumentIds` is AGENT-ONLY — a homeowner could otherwise strip documents the agent chose.
   * Refused while the proposal is frozen: the envelope was assembled from this context, so editing
   * one without killing the other would let them drift.
   * Customer + proposal writes are sequential, not one tx; a partial failure is resolved by the next call.
   */
  applyEnvelopeContext: proposalShareableProcedure
    .input(z.object({
      id: z.string(),
      token: z.string().optional(),
      age: z.number().int().min(CUSTOMER_AGE_MIN).max(CUSTOMER_AGE_MAX).optional(),
      envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)).optional(),
    }).refine(
      v => v.age !== undefined || v.envelopeDocumentIds !== undefined,
      { message: 'Must provide age or envelopeDocumentIds (or both)' },
    ))
    .mutation(async ({ ctx, input }) => {
      // No user on a shareable procedure means the share-token path.
      if (ctx.actor.userId === null && input.envelopeDocumentIds !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Envelope document selection is agent-only.',
        })
      }

      const proposal = dalToTrpc(await getFullView(ctx, { id: input.id }))
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (!proposal.customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
      }

      if (isProposalFrozen(proposal)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot edit agreement context while an envelope exists. Discard or recall the envelope first.',
        })
      }

      // SYSTEM_CONTEXT: visibility was already established by getFullView, and the share token carries no customer-side scope.
      if (input.age !== undefined) {
        dalToTrpc(await customerCrud.update(SYSTEM_CONTEXT, {
          id: proposal.customer.id,
          data: { age: input.age },
        }))
      }

      const finalAge = input.age ?? proposal.customer.customerAge
      const evalCtx = finalAge != null
        ? buildProposalContext(proposal, { ageOverride: finalAge })
        : null
      const evaluation = evalCtx ? evaluateDocuments(evalCtx) : null

      const currentSelection = proposal.envelopeDocumentIds ?? []
      let finalSelection = input.envelopeDocumentIds ?? currentSelection
      if (evalCtx && evaluation) {
        finalSelection = reconcileEnvelopeSelection(finalSelection, evaluation)
        try {
          validateEnvelopeSelection(evalCtx, finalSelection)
        }
        catch (err) {
          if (err instanceof EnvelopeSelectionError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
          }
          throw err
        }
      }

      dalToTrpc(await proposalCrud.update(ctx, {
        id: input.id,
        data: { envelopeDocumentIds: finalSelection },
      }))

      return {
        customerAge: finalAge ?? null,
        envelopeDocumentIds: finalSelection,
        kind: proposal.kind,
        docs: evaluation ? projectAgreementDocs(evaluation) : [],
      }
    }),
})

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { contractService } from '@/shared/services/contracts.service'
import { EnvelopeSelectionError, evaluateDocuments, projectAgreementDocs, reconcileEnvelopeSelection, validateEnvelopeSelection } from '@/shared/services/providers/zoho-sign/lib/documents/evaluate'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

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

  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.createContractEnvelope(ctx, input.proposalId)
    }),

  submitContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.sendContractEnvelope(ctx, input.proposalId)
    }),

  recallContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.recallContractEnvelope(ctx, input.proposalId)
    }),

  /** Zoho drafts can't be recalled — they must be deleted via `PUT /requests/{id}/delete`; `recallContract` is for in-flight envelopes only. */
  discardDraftContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return contractService.discardContractEnvelopeDraft(ctx, input.proposalId)
    }),

  resendContract: agentProcedure
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
      const proposal = dalToTrpc(await getFullView(ctx, { id: input.id }))
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (!proposal.customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
      }

      // The document selection is the agent's: a share link's rules do not name the column.
      if (input.envelopeDocumentIds !== undefined && !(await permit(ctx, 'update', proposalServerSpec, ['envelopeDocumentIds']).probe(input.id))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Envelope document selection is agent-only.' })
      }

      if (isProposalFrozen(proposal)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot edit agreement context while an envelope exists. Discard or recall the envelope first.',
        })
      }

      // Keyed off the proposal the caller reached above, never a client-supplied customer id.
      if (input.age !== undefined) {
        dalToTrpc(await customerCrud.update(systemContext('derived:homeowner-age'), {
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

      // The reconciled selection follows from the age and the registry, not from what the caller may write.
      dalToTrpc(await proposalCrud.update(systemContext('derived:envelope-documents'), {
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

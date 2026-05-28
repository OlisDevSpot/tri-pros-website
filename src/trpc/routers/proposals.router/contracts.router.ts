// ─── Contracts Router (Entity Toolkit Pattern) ──────────────────────────────
// Service-layer sub-router for the agreement section: contract lifecycle
// (draft creation, signing submission, recall, resend, status checks) plus
// the agreement-context surface (customer age + envelope document selection).
//
// Receives the entity toolkit from the parent entity router factory — uses
// entity.authedProcedure / entity.shareableProcedure for pre-configured
// auth + scope middleware.
//
// `applyEnvelopeContext` is the single cross-entity orchestration on this
// router. It writes to BOTH `customer.customerProfileJSON.age` AND
// `proposal.formMetaJSON.envelopeDocumentIds` because they're two faces of
// the same business concept — see DOCS.md anchor below.
// see `src/shared/entities/proposals/DOCS.md#agreement-context-as-coherent-unit`

import type { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractService } from '@/shared/services/contracts.service'
import { EnvelopeSelectionError, evaluateDocuments, projectAgreementDocs, reconcileEnvelopeSelection, validateEnvelopeSelection } from '@/shared/services/providers/zoho-sign/lib/documents/evaluate'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export function createContractsRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  return createTRPCRouter({
    getContractStatus: entity.shareableProcedure
      .input(z.object({ id: z.string(), token: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, input))

        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        if (!proposal.signingRequestId) {
          return null
        }

        const stamps = {
          contractSentAt: proposal.contractSentAt,
          contractViewedAt: proposal.contractViewedAt,
          contractSignedAt: proposal.contractSignedAt,
          contractDeclinedAt: proposal.contractDeclinedAt,
        }

        // Webhook is the source of truth for terminal state — skip the live
        // Zoho call once we've persisted completion or decline.
        if (proposal.contractSignedAt) {
          return { requestId: proposal.signingRequestId, requestStatus: 'completed' as const, signerStatuses: [], ...stamps }
        }
        if (proposal.contractDeclinedAt) {
          return { requestId: proposal.signingRequestId, requestStatus: 'declined' as const, signerStatuses: [], ...stamps }
        }

        try {
          const status = await contractService.getSigningStatus(proposal.signingRequestId)
          return { ...status, ...stamps }
        }
        catch {
          return null
        }
      }),

    createContractDraft: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.createSigningRequest(ctx, input.proposalId)
      }),

    submitContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.sendSigningRequest(ctx, input.proposalId)
      }),

    sendContractForSigning: entity.shareableProcedure
      .input(z.object({ id: z.string(), token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.sendSigningRequest(ctx, input.id)
      }),

    recallContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.recallSigningRequest(ctx, input.proposalId)
      }),

    /**
     * Discards a draft envelope. Drafts can't be recalled in Zoho — they
     * must be deleted via `PUT /requests/{id}/delete`. Use this for the
     * "Discard Draft" UI action; `recallContract` stays for in-progress
     * envelopes only.
     */
    discardDraftContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.discardDraftRequest(ctx, input.proposalId)
      }),

    resendContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.resendSigningRequest(ctx, input.proposalId)
      }),

    /**
     * Returns the current evaluation of the envelope-document registry
     * against this proposal's state — required / optional given customer
     * age, proposal kind, and SOW length. Shareable so the homeowner-side
     * first-time form renders the same evaluation.
     */
    evaluateEnvelopeContext: entity.shareableProcedure
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
        const savedSelection = proposal.formMetaJSON?.envelopeDocumentIds ?? []

        // Without an age we can't evaluate registry rules that depend on it.
        // Surface an empty docs list — UI prompts for the age first.
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
     * Single cross-entity mutation for "alter the agreement context."
     * Both inputs are optional, but at least one must be provided.
     *
     *   - `age` → writes `customer.customerProfileJSON.age` AND silently
     *     reconciles the saved envelope selection against the new age
     *     (adds new required, drops new forbidden).
     *   - `envelopeDocumentIds` → replaces the saved selection. Validated
     *     against the post-reconciliation evaluation.
     *
     * **Auth split**: shareable so the homeowner can submit their own
     * age via the proposal token, but envelope-document selection is
     * AGENT-ONLY. Token-authenticated callers (homeowner) who pass
     * `envelopeDocumentIds` are rejected with FORBIDDEN — they have no
     * legitimate UI surface for that field, and allowing it would let
     * a homeowner strip optional documents the agent chose to include.
     *
     * **Lock**: refuses to apply while `proposal.signingRequestId != null`.
     * Once an envelope of any status exists, the agreement context is
     * frozen — the agent must discard/recall to unlock editing.
     *
     * **Atomicity**: customer + proposal writes happen sequentially without
     * a shared transaction — matches the existing cross-entity pattern in
     * this codebase. Failure of the proposal write leaves a brief
     * inconsistency that the next call resolves.
     */
    applyEnvelopeContext: entity.shareableProcedure
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
        // Token-path callers (ability is null per shareableMiddleware) can
        // only submit their own age. envelopeDocumentIds is agent-only.
        if (ctx.ability == null && input.envelopeDocumentIds !== undefined) {
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

        if (proposal.signingRequestId != null) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot edit agreement context while an envelope exists. Discard or recall the envelope first.',
          })
        }

        // 1. Persist age on the customer (system context — visibility is already
        // established by getFullView above; the homeowner share-token has no
        // customer-side scope to use here).
        if (input.age !== undefined) {
          const existing = dalToTrpc(await customerCrud.getById(SYSTEM_CONTEXT, { id: proposal.customer.id }))
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
          }
          const currentProfile = existing.customerProfileJSON ?? {}
          dalToTrpc(await customerCrud.update(SYSTEM_CONTEXT, {
            id: proposal.customer.id,
            data: { customerProfileJSON: { ...currentProfile, age: input.age } },
          }))
        }

        // 2. Evaluate docs against the final age (single eval, reused for
        // reconcile + return payload).
        const finalAge = input.age ?? proposal.customer.customerAge
        const evalCtx = finalAge != null
          ? buildProposalContext(proposal, { ageOverride: finalAge })
          : null
        const evaluation = evalCtx ? evaluateDocuments(evalCtx) : null

        // 3. Reconcile the selection (silently add required / drop forbidden).
        const currentSelection = proposal.formMetaJSON?.envelopeDocumentIds ?? []
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

        // 4. Persist the proposal-side change.
        dalToTrpc(await proposalCrud.update(ctx, {
          id: input.id,
          data: {
            formMetaJSON: {
              ...(proposal.formMetaJSON ?? {}),
              envelopeDocumentIds: finalSelection,
            },
          },
        }))

        return {
          customerAge: finalAge ?? null,
          envelopeDocumentIds: finalSelection,
          kind: proposal.kind,
          docs: evaluation ? projectAgreementDocs(evaluation) : [],
        }
      }),
  })
}

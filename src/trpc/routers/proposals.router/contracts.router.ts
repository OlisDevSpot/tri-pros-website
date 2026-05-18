// ─── Contracts Router (Entity Toolkit Pattern) ──────────────────────────────
// Service-layer sub-router for proposal contract lifecycle: draft creation,
// signing submission, recall, resend, status checks, and envelope config.
// Receives the entity toolkit from the parent entity router factory — uses
// entity.authedProcedure / entity.shareableProcedure for pre-configured
// auth + scope middleware.
//
// Standalone customer-age submission lives on customersRouter.submitCustomerAge.
// configureDraftEnvelope orchestrates both customer age + envelope doc selection
// as a single business action (agent configuring a draft before sending).

import type { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { zohoSignService } from '@/shared/services/zoho-sign.service'
import { EnvelopeSelectionError, evaluateDocuments, validateEnvelopeSelection } from '@/shared/services/zoho-sign/documents/evaluate'
import { buildProposalContext } from '@/shared/services/zoho-sign/documents/proposal-context'
import { ENVELOPE_DOCUMENTS } from '@/shared/services/zoho-sign/documents/registry'

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
          const status = await zohoSignService.getSigningStatus(proposal.signingRequestId)
          return { ...status, ...stamps }
        }
        catch {
          return null
        }
      }),

    createContractDraft: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return zohoSignService.createSigningRequest(ctx, input.proposalId)
      }),

    submitContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return zohoSignService.sendSigningRequest(ctx, input.proposalId)
      }),

    sendContractForSigning: entity.shareableProcedure
      .input(z.object({ id: z.string(), token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return zohoSignService.sendSigningRequest(ctx, input.id)
      }),

    recallContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return zohoSignService.recallSigningRequest(ctx, input.proposalId)
      }),

    resendContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return zohoSignService.resendSigningRequest(ctx, input.proposalId)
      }),

    /**
     * Drives the agent draft-config form. `ageOverride` previews
     * senior-vs-non-senior rule changes against an unsaved age.
     */
    evaluateEnvelopeDocs: entity.authedProcedure
      .input(z.object({
        proposalId: z.string(),
        ageOverride: z.number().int().min(18).max(120).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        const proposalCtx = buildProposalContext(proposal, { ageOverride: input.ageOverride })
        const { required, optional } = evaluateDocuments(proposalCtx)
        const requiredSet = new Set(required)
        const optionalSet = new Set(optional)
        const docs = ENVELOPE_DOCUMENTS
          .filter(d => requiredSet.has(d.id) || optionalSet.has(d.id))
          .map(d => ({
            id: d.id,
            label: d.label,
            status: requiredSet.has(d.id) ? ('required' as const) : ('optional' as const),
          }))

        return {
          kind: proposalCtx.kind,
          isSenior: proposalCtx.isSenior,
          isLongSow: proposalCtx.isLongSow,
          docs,
        }
      }),

    /**
     * Orchestrates draft envelope configuration: persists customer age AND
     * proposal envelope-document selection. Single business action — agent
     * configures a draft before sending. Validates selection against
     * registry rules with the age override applied.
     */
    configureDraftEnvelope: entity.authedProcedure
      .input(z.object({
        proposalId: z.string(),
        age: z.number().int().min(18).max(120),
        envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }
        if (!proposal.customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
        }

        const evalCtx = buildProposalContext(proposal, { ageOverride: input.age })
        try {
          validateEnvelopeSelection(evalCtx, input.envelopeDocumentIds)
        }
        catch (err) {
          if (err instanceof EnvelopeSelectionError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
          }
          throw err
        }

        // Cross-entity: customer age (SYSTEM_CONTEXT — auth checked by authedProcedure)
        const existing = dalToTrpc(await customerCrud.getById(SYSTEM_CONTEXT, { id: proposal.customer.id }))
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
        }
        const currentProfile = (existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown> | null
        dalToTrpc(await customerCrud.update(SYSTEM_CONTEXT, {
          id: proposal.customer.id,
          data: { customerProfileJSON: { ...currentProfile, age: input.age } } as Record<string, unknown>,
        }))

        // Same-entity: proposal envelope docs (user's own ctx — scoped)
        const updatedFormMeta = {
          ...proposal.formMetaJSON,
          envelopeDocumentIds: input.envelopeDocumentIds,
        }
        dalToTrpc(await proposalCrud.update(ctx, {
          id: input.proposalId,
          data: { formMetaJSON: updatedFormMeta },
        }))

        return { success: true, age: input.age, envelopeDocumentIds: input.envelopeDocumentIds }
      }),
  })
}

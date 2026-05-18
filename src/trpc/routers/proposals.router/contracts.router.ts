// ─── Contracts Router (Entity Toolkit Pattern) ──────────────────────────────
// Service-layer sub-router for proposal contract lifecycle: draft creation,
// signing submission, recall, resend, status checks, and envelope config.
// Receives the entity toolkit from the parent entity router factory — uses
// entity.authedProcedure / entity.shareableProcedure for pre-configured
// auth + scope middleware.
//
// Cross-entity writes (customer profile) use SYSTEM_CONTEXT via
// customerHandlers — these are system-level side-effects not gated by the
// agent's proposal visibility scope.

import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import { contractService } from '@/shared/services/contract.service'
import { EnvelopeSelectionError, evaluateDocuments, validateEnvelopeSelection } from '@/shared/services/zoho-sign/documents/evaluate'
import { buildProposalContext } from '@/shared/services/zoho-sign/documents/proposal-context'
import { ENVELOPE_DOCUMENTS } from '@/shared/services/zoho-sign/documents/registry'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export function createContractsRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  const proposalHandlers = createCrudDal(proposalServerSpec)
  const customerHandlers = createCrudDal(customerServerSpec)

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

    resendContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return contractService.resendSigningRequest(ctx, input.proposalId)
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
     * Atomically persists customer age + proposal envelope-document
     * selection. Selection is re-validated against the registry rules —
     * never trust the client's filter alone.
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

        const proposalCtx = buildProposalContext(proposal, { ageOverride: input.age })
        try {
          validateEnvelopeSelection(proposalCtx, input.envelopeDocumentIds)
        }
        catch (err) {
          if (err instanceof EnvelopeSelectionError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
          }
          throw err
        }

        // Cross-entity customer write — SYSTEM_CONTEXT because this is a
        // system-level side-effect on the customer entity.
        const customerId = proposal.customer.id
        const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: customerId }))
        const existingProfile = (existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown> | null
        const updatedProfile = { ...existingProfile, age: input.age }
        dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
          id: customerId,
          data: { customerProfileJSON: updatedProfile },
        }))

        // Proposal write — user's own scope
        const updatedFormMeta = {
          ...proposal.formMetaJSON,
          envelopeDocumentIds: input.envelopeDocumentIds,
        }
        dalToTrpc(await proposalHandlers.update(ctx, {
          id: input.proposalId,
          data: { formMetaJSON: updatedFormMeta },
        }))

        return { success: true, age: input.age, envelopeDocumentIds: input.envelopeDocumentIds }
      }),

    submitCustomerAge: entity.shareableProcedure
      .input(z.object({
        id: z.string(),
        token: z.string().optional(),
        age: z.number().int().min(18).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.id }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }
        if (!proposal.customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
        }

        // Cross-entity customer write — SYSTEM_CONTEXT because this may be
        // a homeowner submitting via token, not an agent.
        const customerId = proposal.customer.id
        const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: customerId }))
        const existingProfile = (existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown> | null
        const updatedProfile = { ...existingProfile, age: input.age }
        dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
          id: customerId,
          data: { customerProfileJSON: updatedProfile },
        }))

        return { success: true, age: input.age }
      }),
  })
}

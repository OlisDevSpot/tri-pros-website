import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { envelopeDocumentIds } from '@/shared/constants/enums'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { proposals } from '@/shared/db/schema/proposals'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { contractService } from '@/shared/services/contract.service'
import { EnvelopeSelectionError, evaluateDocuments, validateEnvelopeSelection } from '@/shared/services/zoho-sign/documents/evaluate'
import { buildProposalContext } from '@/shared/services/zoho-sign/documents/proposal-context'
import { ENVELOPE_DOCUMENTS } from '@/shared/services/zoho-sign/documents/registry'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const contractsRouter = createTRPCRouter({
  getContractStatus: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canRead = ability.can('read', 'Proposal')
      const hasValidToken = input.token && proposal.token === input.token

      if (!canRead && !hasValidToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Access denied' })
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

  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.createSigningRequest(input.proposalId, ownerKey)
    }),

  submitContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.sendSigningRequest(input.proposalId, ownerKey)
    }),

  sendContractForSigning: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }

      return contractService.sendSigningRequest(input.proposalId, input.token)
    }),

  recallContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.recallSigningRequest(input.proposalId, ownerKey)
    }),

  resendContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.resendSigningRequest(input.proposalId, ownerKey)
    }),

  /**
   * Drives the agent draft-config form. `ageOverride` previews
   * senior-vs-non-senior rule changes against an unsaved age.
   */
  evaluateEnvelopeDocs: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      ageOverride: z.number().int().min(18).max(120).optional(),
    }))
    .query(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      const ctx = buildProposalContext(proposal, { ageOverride: input.ageOverride })
      const { required, optional } = evaluateDocuments(ctx)
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
        scenario: ctx.scenario,
        isSenior: ctx.isSenior,
        isLongSow: ctx.isLongSow,
        docs,
      }
    }),

  /**
   * Atomically persists customer age + proposal envelope-document
   * selection. Selection is re-validated against the registry rules —
   * never trust the client's filter alone.
   */
  configureDraftEnvelope: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      age: z.number().int().min(18).max(120),
      envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)),
    }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (!proposal.customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
      }

      const ctxForValidation = buildProposalContext(proposal, { ageOverride: input.age })
      try {
        validateEnvelopeSelection(ctxForValidation, input.envelopeDocumentIds)
      }
      catch (err) {
        if (err instanceof EnvelopeSelectionError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
        }
        throw err
      }

      const customerId = proposal.customer.id
      const [existingCustomer] = await db
        .select({ customerProfileJSON: customers.customerProfileJSON })
        .from(customers)
        .where(eq(customers.id, customerId))
      const updatedProfile = { ...existingCustomer?.customerProfileJSON, age: input.age }
      const updatedFormMeta = {
        ...proposal.formMetaJSON,
        envelopeDocumentIds: input.envelopeDocumentIds,
      }

      await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ customerProfileJSON: updatedProfile })
          .where(eq(customers.id, customerId))
        await tx
          .update(proposals)
          .set({ formMetaJSON: updatedFormMeta })
          .where(eq(proposals.id, input.proposalId))
      })

      return { success: true, age: input.age, envelopeDocumentIds: input.envelopeDocumentIds }
    }),

  submitCustomerAge: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string().optional(),
      age: z.number().int().min(18).max(120),
    }))
    .mutation(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      // Dual-gate auth: CASL for agents/super-admins, token for homeowners
      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canUpdate = ability.can('update', 'Customer')
      const hasValidToken = input.token && proposal.token === input.token

      if (!canUpdate && !hasValidToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Access denied' })
      }

      if (!proposal.customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
      }

      // Read existing profile to merge (avoid clobbering other fields)
      const [existing] = await db
        .select({ customerProfileJSON: customers.customerProfileJSON })
        .from(customers)
        .where(eq(customers.id, proposal.customer.id))

      const updatedProfile = { ...existing?.customerProfileJSON, age: input.age }

      await db
        .update(customers)
        .set({ customerProfileJSON: updatedProfile })
        .where(eq(customers.id, proposal.customer.id))

      return { success: true, age: input.age }
    }),
})

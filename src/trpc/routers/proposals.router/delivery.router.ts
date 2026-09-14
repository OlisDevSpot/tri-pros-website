// ─── Delivery Router ────────────────────────────────────────────────────────
// Service-layer sub-router for proposal delivery: send email + the homeowner
// "request to move forward" signal. Procedures call pure services + generic
// CRUD DAL. (View recording + stats moved to views.router.ts in S3a.)
//
// Plain leaf: imports pre-scoped procedures from ./procedures — no toolkit arg.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { emailService } from '@/shared/services/email.service'
import { notificationService } from '@/shared/services/notification.service'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure, proposalShareableProcedure } from './procedures'

const sendEmailSchema = z.object({
  proposalId: z.string(),
  customerName: z.string(),
  email: z.email(),
  token: z.string(),
  message: z.string().optional(),
})

export const deliveryRouter = createTRPCRouter({
  /**
   * Sends the proposal email and marks the proposal as sent. Does NOT
   * touch envelope state — see ADR-0004 (amendment 2026-07-18: envelope
   * creation is a manual agent decision on the envelope card; nothing
   * auto-creates a draft anymore).
   * see `src/shared/modules/proposals/core/DOCS.md#proposal-contract-independence`
   */
  sendProposalEmail: proposalProcedure
    .input(sendEmailSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Send email — pure service, no DB
      const { data } = await emailService.sendProposalEmail({
        proposalId: input.proposalId,
        token: input.token,
        customerName: input.customerName,
        email: input.email,
        message: input.message,
        replyTo: ctx.session.user.email,
        repName: ctx.session.user.name,
      })

      // 2. Update proposal status via generic CRUD
      const proposal = dalToTrpc(await proposalCrud.update(ctx, {
        id: input.proposalId,
        data: { status: 'sent', sentAt: new Date().toISOString() },
      }))

      // 3. Cross-entity side-effect: derive meeting outcome.
      // @migration(meetings-entity-router)
      // SYSTEM_CONTEXT because this is a system-level side-effect on the
      // meetings entity, not gated by the agent's proposal visibility.
      if (proposal.meetingId) {
        dalToTrpc(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: proposal.meetingId }))
      }

      return { data, proposal }
    }),

  /**
   * Homeowner "Request Agreement" (share-token path). A pure SIGNAL: the
   * homeowner NEVER touches the contract lifecycle — this notifies the
   * proposal's meeting participants (email + push) that the homeowner is
   * ready to move forward, and the agent manually drives the draft
   * lifecycle from there (#264).
   * see `src/shared/modules/proposals/core/DOCS.md#proposal-lock-ladder`
   */
  requestToMoveForward: proposalShareableProcedure
    .input(z.object({ id: z.string(), token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const proposal = dalToTrpc(await getFullView(ctx, input))
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (proposal.contractSignedAt) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This agreement has already been signed.' })
      }

      await notificationService.notifyHomeownerMoveForwardRequest({
        proposalId: proposal.id,
        proposalLabel: proposal.label ?? '',
        meetingId: proposal.meetingId,
        customerName: proposal.customer?.name ?? 'A homeowner',
      })

      return { requested: true }
    }),
})

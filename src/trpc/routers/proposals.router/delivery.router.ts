import { TRPCError } from '@trpc/server'
import z from 'zod'

import { systemContext } from '@/shared/dal/server/lib/contexts'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { SHARE_LINK_LIMITS } from '@/shared/modules/proposals/core/lib/share-link-rate-limit'
import { emailService } from '@/shared/services/email.service'
import { notificationService } from '@/shared/services/notification.service'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

const sendEmailSchema = z.object({
  proposalId: z.string(),
  customerName: z.string(),
  email: z.email(),
  message: z.string().optional(),
})

export const deliveryRouter = createTRPCRouter({
  /**
   * Sends the proposal email and marks the proposal as sent. Does NOT
   * touch envelope state — see ADR-0004 (amendment 2026-07-18: envelope
   * creation is a manual agent decision on the envelope card; nothing
   * auto-creates a draft anymore).
   */
  sendProposalEmail: agentProcedure
    .input(sendEmailSchema)
    .mutation(async ({ ctx, input }) => {
      // The link carries the proposal's own token, never one the caller supplies.
      const current = dalToTrpc(await proposalCrud.getById(ctx, { id: input.proposalId }))
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      // 1. Send email — pure service, no DB
      const { data } = await emailService.sendProposalEmail({
        proposalId: input.proposalId,
        token: current.token,
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

      // 3. The meeting's outcome follows from the send; the sender's meeting reach does not decide it.
      if (proposal.meetingId) {
        dalToTrpc(await deriveOutcomeOnProposalSent(systemContext('derived:proposal-sent'), { meetingId: proposal.meetingId }))
      }

      return { data, proposal }
    }),

  /**
   * Homeowner "Request Agreement" (share-token path). A pure SIGNAL: the
   * homeowner NEVER touches the contract lifecycle — this notifies the
   * proposal's meeting participants (email + push) that the homeowner is
   * ready to move forward, and the agent manually drives the draft
   * lifecycle from there (#264).
   */
  requestToMoveForward: proposalShareableProcedure
    .input(z.object({ id: z.string(), token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        const { success } = await SHARE_LINK_LIMITS.moveForward.limit(input.token)
        if (!success) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Your request was already sent. Please wait before sending it again.' })
        }
      }
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

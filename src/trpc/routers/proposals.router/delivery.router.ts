import { TRPCError } from '@trpc/server'
import z from 'zod'

import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { SHARE_LINK_LIMITS } from '@/shared/modules/proposals/core/lib/share-link-rate-limit'
import { proposalService } from '@/shared/modules/proposals/service'
import { notificationService } from '@/shared/services/notification.service'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

const sendEmailSchema = z.object({
  proposalId: z.string().uuid(),
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
    .mutation(async ({ ctx, input }) => dalToTrpc(await proposalService.business.send(ctx, {
      ...input,
      sender: { name: ctx.session.user.name, email: ctx.session.user.email },
    }))),

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
        const { success } = await SHARE_LINK_LIMITS.moveForward(input.token)
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

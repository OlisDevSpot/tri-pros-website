// ─── Delivery Router (Entity Toolkit Pattern) ───────────────────────────────
// Service-layer sub-router for proposal delivery: send email, record view,
// get view stats. Receives the entity toolkit from the parent entity router
// factory — uses entity.authedProcedure / entity.publicProcedure for
// pre-configured auth + scope middleware.
//
// Orchestration pattern: procedure calls pure services (email, notification),
// generic CRUD DAL (proposalCrud.update), cross-entity DAL, and dispatches jobs.
// No direct db imports. No deprecated DAL functions.

import type { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { recordProposalView } from '@/shared/entities/proposals/dal/server/mutations'
import { getFullView, getProposalViews } from '@/shared/entities/proposals/dal/server/queries'
import { emailService } from '@/shared/services/email.service'
import { sendViewNotificationJob } from '@/shared/services/providers/upstash/jobs/send-view-notification'
import { syncContractDraftJob } from '@/shared/services/providers/upstash/jobs/sync-contract-draft'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

const sendEmailSchema = z.object({
  proposalId: z.string(),
  customerName: z.string(),
  email: z.email(),
  token: z.string(),
  message: z.string().optional(),
})

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export function createDeliveryRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  return createTRPCRouter({
    sendProposalEmail: entity.authedProcedure
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

        // 3. Cross-entity side-effect: derive meeting outcome
        // @migration(meetings-entity-router)
        // Uses SYSTEM_CONTEXT because this is a system-level side-effect on
        // the meetings entity, not gated by the agent's proposal visibility.
        // When meetings migrates to entity router, this call stays the same —
        // the DAL function already accepts ScopedContext.
        if (proposal.meetingId) {
          dalToTrpc(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: proposal.meetingId }))
        }

        // 4. Dispatch async contract draft sync job
        await syncContractDraftJob.dispatch({ proposalId: input.proposalId })

        return { data, proposal }
      }),

    recordView: entity.publicProcedure
      .input(recordViewSchema)
      .mutation(async ({ input }) => {
        // 1. Fetch proposal with customer join — SYSTEM_CONTEXT because publicProcedure
        // has no session. Uses getFullView (not handlers.getById) because we need
        // customer.name for the notification job payload.
        const proposal = dalToTrpc(await getFullView(SYSTEM_CONTEXT, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        // 2. Manual token validation — token IS the authorization on this path
        if (proposal.token !== input.token) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
        }

        // 3. Record the view via entity DAL
        const view = dalToTrpc(await recordProposalView({
          proposalId: input.proposalId,
          source: input.source,
          referer: input.referer,
          userAgent: input.userAgent,
        }))

        // 4. Dispatch notification job (fire-and-forget) with pre-assembled params
        void sendViewNotificationJob.dispatch({
          proposalOwnerId: proposal.ownerId,
          proposalLabel: proposal.label,
          proposalId: input.proposalId,
          customerName: proposal.customer?.name ?? 'Customer',
          viewedAt: view.viewedAt,
          source: input.source,
        }).catch(() => {})
      }),

    getProposalViews: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .query(async ({ input }) => {
        return dalToTrpc(await getProposalViews({ proposalId: input.proposalId }))
      }),
  })
}

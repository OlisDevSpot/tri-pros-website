// ─── Views Router ───────────────────────────────────────────────────────────
// proposal_views child rows. `recordView` is the public homeowner-open path
// (token IS the authorization — no session); `getProposalViews` is the
// agent-facing stats read. Moved out of delivery.router (S3a) into the child's
// own leaf. Until S3b's subEntitySpec lands, this reuses the parent proposal
// procedures + a manual token check, exactly as delivery did.
//
// Plain leaf: imports pre-scoped procedures from ./procedures.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { recordProposalView } from '@/shared/entities/proposal-views/dal/server/mutations'
import { getProposalViews } from '@/shared/entities/proposal-views/dal/server/queries'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { sendViewNotificationJob } from '@/shared/services/providers/upstash/jobs/send-view-notification'

import { createTRPCRouter, systemProcedure } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure } from './procedures'

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export const viewsRouter = createTRPCRouter({
  recordView: systemProcedure
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

      // 3. Record the view via the proposal-views DAL
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

  getProposalViews: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getProposalViews(ctx, { proposalId: input.proposalId }))
    }),
})

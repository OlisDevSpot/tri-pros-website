// ─── Views Router ───────────────────────────────────────────────────────────
// proposal_views child rows. `recordView` is the public homeowner-open path
// (token IS the authorization — no session); `getProposalViews` is the
// agent-facing stats read. Moved out of delivery.router (S3a) into the child's
// own leaf. Until S3b's subEntitySpec lands, `getProposalViews` reuses the
// parent proposal procedures; `recordView` is authorized via the canonical
// share-token → tokenActor path (`resolveShareTokenActor`, engine-scoped
// read), not a manual token compare.
//
// Plain leaf: imports pre-scoped procedures from ./procedures.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { resolveShareTokenActor } from '@/shared/domains/permissions/lib/share-token-actor'
import { recordProposalView } from '@/shared/entities/proposal-views/dal/server/mutations'
import { getProposalViews } from '@/shared/entities/proposal-views/dal/server/queries'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
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
      // 1. Validate the share token → engine-scoped actor. Token IS the
      // authorization on this path (systemProcedure has no session).
      const actor = await resolveShareTokenActor(input.token, 'proposal')
      if (!actor) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }

      // 2. Fetch proposal with customer join, scoped to exactly the token's
      // row. Uses getFullView (not handlers.getById) because we need
      // customer.name for the notification job payload.
      const proposal = dalToTrpc(await getFullView(
        { session: null, ability: null, scope: resolveActorScope(proposalServerSpec, actor), actor },
        { id: input.proposalId },
      ))
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
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

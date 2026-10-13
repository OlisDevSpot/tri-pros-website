// Proposal views service — the `proposal_views` child: the homeowner-open path.
//
//   ...proposalViewCrud   the engine's five slots on the service itself (append-only
//                         semantics are a convention, not a type: nothing writes
//                         `update`/`delete` today, and the engine keeps them scoped)
//   record                orchestration: read the proposal, insert via `proposalViewsService.create`,
//                         queue the "Proposal Viewed" push to the meeting's
//                         participants. Origin-agnostic — tRPC today; a route
//                         handler or job tomorrow.
//
// Self-reference is by the exported name (`proposalViewsService.create`), never
// `this`; imported services are referenced only inside method bodies (see
// ../service.ts for the cycle rule).
//
// Authorization: the caller's context decides — a share link reaches only its own proposal and may add views to it.
//
// Recipients: a proposal has NO owner — it is reached through its meeting, and
// the people responsible for it are that meeting's participants (all of them),
// PLUS the info@ system user, always. `proposals.ownerId` is the author and
// never a recipient. Recipients are resolved HERE (peer reads into the meetings
// and users DALs) and passed to the job, so the notification service stays free
// of recipient lookups. No meeting ⇒ info@ alone.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { proposalViewCrud } from '@/shared/modules/proposals/views/dal/server/crud'
import { sendViewNotificationJob } from '@/shared/services/providers/upstash/jobs/send-view-notification'

/** The insert columns the homeowner-open path supplies. */
export type RecordProposalViewInput = Pick<InsertProposalView, 'proposalId' | 'referer' | 'userAgent'> & {
  /** Required here (the tRPC schema defaults it) — the notification payload needs a concrete source. */
  source: NonNullable<InsertProposalView['source']>
}

export const proposalViewsService = {
  ...proposalViewCrud,

  /**
   * Records a homeowner view. `not-found` when the proposal is invisible to `ctx`.
   * The push job is dispatched after the row is committed (naked write = autocommit)
   * and is fire-and-forget — an enqueue failure never fails the view.
   */
  async record(ctx: ScopedContext, input: RecordProposalViewInput): Promise<DalReturn<ProposalView>> {
    return dalDbOperation(async () => {
      // getFullView (not proposalService.getById) because the notification payload needs customer.name.
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: input.proposalId }))
      if (!proposal) {
        throw new ThrowableDalError({ type: 'not-found' })
      }

      const view = dalVerifySuccess(await proposalViewsService.create(ctx, {
        proposalId: input.proposalId,
        source: input.source,
        referer: input.referer,
        userAgent: input.userAgent,
      }))

      const participantIds = proposal.meetingId
        ? (await getParticipantsForMeeting(proposal.meetingId)).map(p => p.userId)
        : []
      const recipientUserIds = [...new Set([...participantIds, await getSystemOwnerId()])]

      void sendViewNotificationJob.dispatch({
        recipientUserIds,
        proposalLabel: proposal.label,
        proposalId: input.proposalId,
        customerName: proposal.customer?.name ?? 'Customer',
        viewedAt: view.viewedAt,
        source: input.source,
      }).catch((err) => {
        console.error('[proposalService.views.record] notification enqueue failed', err)
      })

      return view
    })
  },
} as const

export type ProposalViewsService = typeof proposalViewsService

// Proposal views service — the `proposal_views` child: the homeowner-open path.
//
//   ...proposalViewCrud   the engine's five slots on the service itself (append-only
//                         semantics are a convention, not a type: nothing writes
//                         `update`/`delete` today, and the engine keeps them scoped)
//   record                orchestration: read the proposal, prove the caller with
//                         the share token, insert via `proposalViewsService.create`,
//                         queue the "Proposal Viewed" push to the meeting's
//                         participants. Origin-agnostic — tRPC today; a route
//                         handler or job tomorrow.
//
// Self-reference is by the exported name (`proposalViewsService.create`), never
// `this`; imported services are referenced only inside method bodies (see
// ../service.ts for the cycle rule).
//
// Authorization: the token IS the authorization on this path (no session), so
// the caller passes SYSTEM_CONTEXT and the token compare lives HERE, not in the
// router. #285 replaces the compare with a bearer actor on `ctx` (D-11); the
// method signature does not change when that lands.
// see ../core/DOCS.md#shareable-via-token
//
// Recipients: a proposal has NO owner — it is reached through its meeting, and
// the people responsible for it are that meeting's participants (all of them),
// PLUS the info@ system user, always. `proposals.ownerId` is the author and
// never a recipient. Recipients are resolved HERE (peer reads into the meetings
// and users DALs) and passed to the job, so the notification service stays free
// of recipient lookups. No meeting ⇒ info@ alone.
// see ../core/DOCS.md#visibility-via-meeting-participation

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { proposalViewCrud } from '@/shared/modules/proposals/views/dal/server/crud'
import { sendViewNotificationJob } from '@/shared/services/providers/upstash/jobs/send-view-notification'

/** The insert columns the homeowner-open path supplies, plus the share token that authorizes it. */
export type RecordProposalViewInput = Pick<InsertProposalView, 'proposalId' | 'referer' | 'userAgent'> & {
  token: string
  /** Required here (the tRPC schema defaults it) — the notification payload needs a concrete source. */
  source: NonNullable<InsertProposalView['source']>
}

export const proposalViewsService = {
  ...proposalViewCrud,

  /**
   * Records a homeowner view. `not-found` when the proposal is invisible to
   * `ctx`; `forbidden` when the token does not match. The push job is
   * dispatched after the row is committed (naked write = autocommit) and is
   * fire-and-forget — an enqueue failure never fails the view.
   */
  async record(ctx: ScopedContext, input: RecordProposalViewInput): Promise<DalReturn<ProposalView>> {
    return dalDbOperation(async () => {
      // getFullView (not proposalService.getById) because the notification payload needs customer.name.
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: input.proposalId }))
      if (!proposal) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (proposal.token !== input.token) {
        throw new ThrowableDalError({ type: 'forbidden' })
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

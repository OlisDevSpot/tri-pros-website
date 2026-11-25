import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Proposal } from '@/shared/db/schema'

import { systemContext } from '@/shared/dal/server/lib/contexts'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { createActivity } from '@/shared/entities/activities/dal/server/mutations'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { canSendProposal } from '@/shared/modules/proposals/core/lib/can-send-proposal'
import { emailService } from '@/shared/services/email.service'

export const proposalBusinessService = {
  /**
   * Sends the proposal to its customer and records what the rep wrote. The note is an activity on the proposal until
   * activities and customer notes become one record.
   */
  async send(ctx: ScopedContext, input: { proposalId: string, message?: string, sender: { name: string, email: string } }): Promise<DalReturn<{ proposal: Proposal }>> {
    return dalDbOperation(async () => {
      const view = dalVerifySuccess(await getFullView(ctx, { id: input.proposalId }))
      if (!view?.customer) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!canSendProposal(view)) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.notSendable })
      }
      const email = view.customer.email
      if (!email) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.customerEmailMissing })
      }
      const message = input.message?.trim() || undefined
      await emailService.sendProposalEmail({
        proposalId: view.id,
        token: view.token,
        customerName: view.customer.name,
        email,
        message,
        replyTo: input.sender.email,
        repName: input.sender.name,
        reps: view.meetingReps.map(rep => ({ name: rep.name, phone: rep.phone })),
      })
      // The email is out: the stamp must land, but the note and the outcome are follow-ons. A failure there is logged
      // and never fails the send, so the rep is never invited to resend an email the homeowner already has.
      const proposal = dalVerifySuccess(await proposalCrud.update(ctx, { id: view.id, data: { status: 'sent', sentAt: new Date().toISOString() } }))
      // Null only for the system context, which never sends.
      const ownerId = ctx.actor.userId
      if (ownerId) {
        const noted = await createActivity(ctx, { type: 'note', title: 'Proposal sent', description: message ?? '', entityType: 'proposal', entityId: view.id, ownerId })
        if (!noted.success) {
          console.error('[proposals] send: the email went out but the note was not recorded', { proposalId: view.id }, noted.error)
        }
      }
      if (proposal.meetingId) {
        const derived = await deriveOutcomeOnProposalSent(systemContext('derived:proposal-sent'), { meetingId: proposal.meetingId })
        if (!derived.success) {
          console.error('[proposals] send: the email went out but the meeting outcome was not derived', { proposalId: view.id }, derived.error)
        }
      }
      return { proposal }
    })
  },
}

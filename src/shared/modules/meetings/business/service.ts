import type { HomeownerConfirmation, MeetingOutcome } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'

import { canRescheduleFromOutcome, outcomeRequiresReason, RESCHEDULED_ORIGINAL_REASON } from '@/shared/constants/enums/meetings'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { listNotesForEntity } from '@/shared/entities/customer-notes/dal/server/queries'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { claimHomeownerConfirmation, handOffVisit } from '@/shared/entities/meetings/dal/server/mutations'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getRescheduleChain, getRescheduleSuccessorId } from '@/shared/entities/meetings/dal/server/queries'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { isVisitMessageEligible } from '@/shared/modules/meetings/conversations/lib/is-visit-message-eligible'
import { rescheduledOriginalOutcome } from '@/shared/modules/meetings/core/lib/rescheduled-original-outcome'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'

export const meetingBusinessService = {
  /**
   * The visit's internal notes, newest first. The scoped read is the meeting's visibility check; the notes are
   * customer notes, so they also need the customer-note read. A reschedule moves the visit, so notes written on
   * the meetings it replaced come with it.
   */
  async listInternalNotes(ctx: ScopedContext, input: { meetingId: string }): Promise<DalReturn<CustomerNoteWithAuthor[]>> {
    return dalDbOperation(async () => {
      if (ctx.actor.ability.cannot('read', 'CustomerNote')) {
        throw new ThrowableDalError({ type: 'forbidden' })
      }
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!meeting.customerId) {
        return []
      }
      const chain = dalVerifySuccess(await getRescheduleChain(ctx, { meetingId: meeting.id }))
      return listNotesForEntity({ customerId: meeting.customerId, entityType: 'meeting', entityIds: chain })
    })
  },

  /**
   * Sets an outcome that needs a documented reason and writes the reason as a customer note.
   * Positive, unset and neutral outcomes go through the plain update instead.
   */
  async setOutcomeWithReason(
    ctx: ScopedContext,
    input: { meetingId: string, outcome: MeetingOutcome, reason: string },
  ): Promise<DalReturn<Meeting>> {
    return dalDbOperation(async () => {
      if (!outcomeRequiresReason(input.outcome)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `Outcome "${input.outcome}" does not require a reason; use crud.update.`,
        })
      }

      // The note is written after the outcome; its customer is probed first so a meeting is never
      // changed by an actor whose note on it would then be refused.
      const current = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!current) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (current.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(current.customerId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }

      const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: input.outcome },
      }))

      if (updated.customerId) {
        dalVerifySuccess(await customerNoteCrud.create(ctx, {
          customerId: updated.customerId,
          content: `${formatMeetingDateShort(updated.scheduledFor)} meeting results:\nOutcome set to ${MEETING_OUTCOME_LABELS[input.outcome]}\n${input.reason}`,
        }))
      }

      return updated
    })
  },

  /**
   * Books the same visit in a new slot: the replacement carries the owner, participants, customer, project, type,
   * setter, flow state and visit note, and takes over the link, the calendar event and the invite. The original
   * then reads `rescheduled`, or keeps a no-show or cancellation it already had.
   * Not one transaction: meetingCrud's after-hooks dispatch jobs and write participants outside one.
   * The replacement is created first, so a failure never leaves a moved visit with nothing after it.
   */
  async reschedule(
    ctx: ScopedContext,
    input: { meetingId: string, newScheduledFor: string, reason: string },
  ): Promise<DalReturn<Meeting>> {
    return dalDbOperation(async () => {
      if (new Date(input.newScheduledFor).getTime() <= Date.now()) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'The new meeting time must be in the future.' })
      }

      const original = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!original) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (original.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(original.customerId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!canRescheduleFromOutcome(original.meetingOutcome)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: original.meetingOutcome === 'rescheduled'
            ? RESCHEDULED_ORIGINAL_REASON
            : `A meeting with outcome "${original.meetingOutcome}" already happened and can't be rescheduled — book a new meeting instead.`,
        })
      }

      // A second reschedule would fork the chain and carry the share token to the wrong replacement.
      if (await getRescheduleSuccessorId(original.id)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'This meeting was already rescheduled; reschedule the new meeting instead.',
        })
      }

      // The replacement carries the whole sit, the deal structure included; the actor's own read may withhold that column.
      const system = systemContext('derived:meeting-reschedule')
      const carried = dalVerifySuccess(await meetingCrud.getById(system, { id: original.id }))

      // Visibility follows participants, so the replacement's owner is the original's owner participant.
      const participants = await getParticipantsForMeeting(input.meetingId)
      const ownerParticipant = participants.find(participant => participant.role === 'owner')

      // A system create keeps this ownerId: an authed create would resolve the owner from the acting user.
      const replacement = dalVerifySuccess(await meetingCrud.create(system, {
        ownerId: ownerParticipant?.userId ?? original.ownerId,
        customerId: original.customerId,
        projectId: original.projectId,
        meetingType: original.meetingType,
        // A pre-setter original has none: undefined lets the hook default it, where a null would be refused.
        setBy: original.setBy ?? undefined,
        scheduledFor: input.newScheduledFor,
        rescheduledFromId: original.id,
        // The insert schema takes undefined, not null.
        flowStateJSON: carried?.flowStateJSON ?? undefined,
        visitNote: carried?.visitNote ?? undefined,
      }))

      for (const participant of participants) {
        if (participant.role !== 'owner') {
          await addParticipant(replacement.id, participant.userId, participant.role)
        }
      }

      // The hand-off comes first: once the original stops being live, nothing may still find an event on it.
      const handOff = await handOffVisit({ fromMeetingId: original.id, toMeetingId: replacement.id })
      if (!handOff.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'Meeting rescheduled, but the visit link and calendar event did not carry over to the new meeting.',
        })
      }

      // The visit has already moved, so a failure past this point must not read as if nothing happened.
      try {
        const originalOutcome = rescheduledOriginalOutcome(original.meetingOutcome)
        if (originalOutcome) {
          dalVerifySuccess(await meetingCrud.update(ctx, { id: input.meetingId, data: { meetingOutcome: originalOutcome } }))
        }

        // One sync after the hand-off: Google moves the event the homeowner already has and sends one updated invitation.
        await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: replacement.id })
      }
      catch (err) {
        console.error('[meetings] reschedule: the visit moved but its outcome or calendar step failed', { meetingId: original.id, replacementId: replacement.id }, err)
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'Meeting rescheduled, but the calendar was not updated; open the new meeting and save it to retry.',
        })
      }

      if (original.customerId) {
        const note = await customerNoteCrud.create(ctx, {
          customerId: original.customerId,
          content: buildRescheduleNote(original.scheduledFor, input.newScheduledFor, input.reason),
          entityType: 'meeting',
          entityId: replacement.id,
        })
        if (!note.success) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Meeting rescheduled but note failed.' })
        }
      }

      // The system-created row is unprojected; the actor receives what their own read would.
      return projectToReadFields(ctx.actor.ability, meetingServerSpec, { ...replacement, shareToken: original.shareToken }, replacement) as Meeting
    })
  },

  /** The homeowner's own "I'll be there", by text or on the page. Never sets `confirmedAt`: that stays the office's. */
  async confirmByHomeowner(
    ctx: ScopedContext,
    input: { meetingId: string, via: HomeownerConfirmation },
  ): Promise<DalReturn<{ meeting: Meeting, confirmed: boolean }>> {
    return dalDbOperation(async () => {
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'This visit can no longer be confirmed.' })
      }
      const claimed = await claimHomeownerConfirmation({ meetingId: meeting.id, via: input.via })
      return { meeting: claimed ?? meeting, confirmed: claimed != null }
    })
  },

} as const

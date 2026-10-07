import type { MeetingOutcome } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'

import { canRescheduleFromOutcome, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { handOffShareToken } from '@/shared/entities/meetings/dal/server/mutations'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'

export const meetingBusinessService = {
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
   * Keeps the original (set to cancelled) and books a new meeting at the new time, carrying the owner,
   * participants, customer, project, type, setter and flow state: the same sit in a new slot.
   * Not one transaction: meetingCrud's after-hooks dispatch jobs and write participants outside one.
   * The replacement is created first, so a failure never leaves a cancelled meeting with nothing after it.
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
      if (!canRescheduleFromOutcome(original.meetingOutcome)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `A meeting with outcome "${original.meetingOutcome}" already happened and can't be rescheduled — book a new meeting instead.`,
        })
      }

      // Visibility follows participants, so the replacement's owner is the original's owner participant.
      const participants = await getParticipantsForMeeting(input.meetingId)
      const ownerParticipant = participants.find(participant => participant.role === 'owner')

      // SYSTEM_CONTEXT so create.before keeps this ownerId; an authed create would hand the meeting to the office user.
      const replacement = dalVerifySuccess(await meetingCrud.create(SYSTEM_CONTEXT, {
        ownerId: ownerParticipant?.userId ?? original.ownerId,
        customerId: original.customerId,
        projectId: original.projectId,
        meetingType: original.meetingType,
        // A pre-setter original has none: undefined lets the hook default it, where a null would be refused.
        setBy: original.setBy ?? undefined,
        scheduledFor: input.newScheduledFor,
        rescheduledFromId: original.id,
        // The insert schema takes undefined, not null.
        flowStateJSON: original.flowStateJSON ?? undefined,
      }))

      for (const participant of participants) {
        if (participant.role !== 'owner') {
          await addParticipant(replacement.id, participant.userId, participant.role)
        }
      }

      dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: 'cancelled' },
      }))

      // Once the replacement exists a failure has to say so: a bare error reads as "try again", and a cancelled original can be rescheduled a second time.
      const handOff = await handOffShareToken({ fromMeetingId: original.id, toMeetingId: replacement.id })
      if (!handOff.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'Meeting rescheduled, but the original visit link did not carry over to the new meeting.',
        })
      }

      if (original.customerId) {
        const note = await customerNoteCrud.create(ctx, {
          customerId: original.customerId,
          content: buildRescheduleNote(original.scheduledFor, input.newScheduledFor, input.reason),
        })
        if (!note.success) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Meeting rescheduled but note failed.' })
        }
      }

      return { ...replacement, shareToken: original.shareToken }
    })
  },
} as const

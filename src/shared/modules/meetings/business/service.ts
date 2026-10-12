import type { HomeownerConfirmation, MeetingOutcome } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'
import type { VisitInviteResult } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageRunReport } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'
import type { MessagingInboundWebhookPayload } from '@/shared/services/providers/twilio/schemas/messaging'

import { publicUrl } from '@/shared/config/public-url'
import { canRescheduleFromOutcome, outcomeRequiresReason, RESCHEDULED_ORIGINAL_REASON } from '@/shared/constants/enums/meetings'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { listNotesForEntity } from '@/shared/entities/customer-notes/dal/server/queries'
import { findCustomersByPhone } from '@/shared/entities/customers/dal/server/queries'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { claimHomeownerConfirmation, handOffVisit } from '@/shared/entities/meetings/dal/server/mutations'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getRescheduleChain, getRescheduleSuccessorId } from '@/shared/entities/meetings/dal/server/queries'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { formatPhone } from '@/shared/lib/phone'
import { rescheduledOriginalOutcome } from '@/shared/modules/meetings/core/lib/rescheduled-original-outcome'
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'
import { findReplyTargetMeeting, getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { getTemplateBodies } from '@/shared/modules/meetings/messages/dal/server/settings'
import { deliverVisitText } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { runAutomaticKind } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'
import { notificationService } from '@/shared/services/notification.service'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

export type HomeownerReplyAction = 'opt_out' | 'opt_in' | 'help' | 'confirmed' | 'already_confirmed' | 'forwarded' | 'duplicate' | 'not_main_line'

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
  /**
   * The meeting welcome text. The setter sends it during the booking call, and staff resend it after a time change.
   * It also invites the homeowner to the visit's calendar event, whatever the text's outcome: the calendar sync sends
   * Google's invite. The invite is stored before the text goes: a failure while storing it leaves no text sent, so a
   * retry texts once.
   */
  async sendVisitSummary(
    ctx: ScopedContext,
    input: { meetingId: string },
  ): Promise<DalReturn<{ sms: MeetingMessage, invite: VisitInviteResult }>> {
    return dalDbOperation(async () => {
      // The scoped read is the visibility check; the unscoped context read is for the send.
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Visit messages go to upcoming, undecided, non-project meetings only.' })
      }
      if (!dalVerifySuccess(await voipDidsService.getMainLineDid())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'No main line is configured.' })
      }
      const context = await getVisitMessageContext(meeting.id)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }

      let invite: VisitInviteResult
      if (!context.customer?.email) {
        invite = 'no_email'
      }
      else if (meeting.homeownerInvitedAt) {
        invite = 'already_invited'
      }
      else {
        dalVerifySuccess(await meetingCrud.update(ctx, { id: meeting.id, data: { homeownerInvitedAt: new Date().toISOString() } }))
        invite = 'invited'
      }

      const text = await deliverVisitText(ctx, {
        context,
        templateKey: 'visit_summary',
        bodies: await getTemplateBodies(),
        mediaUrl: [publicUrl('/api/company/vcard')],
      })
      const sms = dalVerifySuccess(await meetingMessageCrud.create(ctx, {
        meetingId: meeting.id,
        kind: 'visit_summary',
        channel: 'sms',
        forScheduledFor: meeting.scheduledFor,
        status: text.status,
        reason: text.reason,
        voipMessageId: text.voipMessageId,
        actorUserId: ctx.actor.userId,
      }))

      return { sms, invite }
    })
  },

  /** The 6 PM Pacific run. `now` is the delivery instant; the run resolves its own scheduled instant from it. */
  async sendDayBeforeReminders(ctx: ScopedContext, input: { now: Date }): Promise<DalReturn<VisitMessageRunReport>> {
    return dalDbOperation(() => runAutomaticKind(ctx, 'day_before_reminder', input.now))
  },

  /** The 8:30 AM Pacific run. */
  async sendRepConfirmations(ctx: ScopedContext, input: { now: Date }): Promise<DalReturn<VisitMessageRunReport>> {
    return dalDbOperation(() => runAutomaticKind(ctx, 'rep_confirmation', input.now))
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

  /**
   * A text that arrived on the main line. Every reply is stored on the thread; a reply that matches a visit
   * is recorded against it. Opt-outs come from Twilio's own verdict, never from a keyword list of ours.
   */
  async handleHomeownerReply(
    ctx: ScopedContext,
    input: { providerMessageId: string, from: string, to: string, body: string, mediaCount: number, optOutType: MessagingInboundWebhookPayload['OptOutType'] | null },
  ): Promise<DalReturn<{ action: HomeownerReplyAction, meetingId: string | null }>> {
    return dalDbOperation(async () => {
      const did = dalVerifySuccess(await voipDidsService.getDidByE164(input.to))
      const matched = dalVerifySuccess(await findCustomersByPhone(input.from))
      const recorded = dalVerifySuccess(await voipMessagesService.recordInboundMessage(ctx, {
        providerMessageId: input.providerMessageId,
        voipDidId: did?.id ?? null,
        customerId: matched[0]?.id ?? null,
        remoteE164: input.from,
        body: input.body,
      }))

      const target = await findReplyTargetMeeting({ customerIds: matched.map(customer => customer.id), now: new Date() })
      const meetingId = target?.meeting.id ?? null
      const scheduledFor = target?.meeting.scheduledFor ?? null
      const customerName = target?.customer?.name ?? matched[0]?.name ?? formatPhone(input.from)

      // Twilio delivers at least once; the first delivery did everything below.
      if (!recorded.inserted) {
        return { action: 'duplicate', meetingId }
      }
      // Only the main line carries visit replies; a text to an agent's own number is for that agent.
      const onMainLine = did?.isMainLine === true
      if (onMainLine && target) {
        dalVerifySuccess(await meetingMessageCrud.create(ctx, {
          meetingId: target.meeting.id,
          kind: 'homeowner_reply',
          channel: 'sms',
          forScheduledFor: target.meeting.scheduledFor,
          status: 'received',
          voipMessageId: recorded.id,
        }))
      }

      // A STOP to any of our numbers opts out: every line sits in one messaging service, which carriers treat as one sender.
      if (input.optOutType === 'STOP') {
        for (const customer of matched) {
          await complianceService.addToDnc({ customerId: customer.id, reason: 'stop_keyword' })
        }
        const visitId = onMainLine ? meetingId : null
        await notificationService.notifyHomeownerOptedOut({ meetingId: visitId, scheduledFor: onMainLine ? scheduledFor : null, customerName, body: input.body })
        return { action: 'opt_out', meetingId: visitId }
      }
      if (!onMainLine) {
        return { action: 'not_main_line', meetingId: null }
      }
      // Twilio flags a YES as an opt-in while YES is one of the messaging service's opt-in keywords.
      const confirms = target != null && matchReplyKeyword(input.body) === 'confirm'
      if (input.optOutType === 'START' && !confirms) {
        // Opting back in to texts says nothing about calls, so do-not-contact stays.
        await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body, hasPhoto: input.mediaCount > 0 })
        return { action: 'opt_in', meetingId }
      }
      if (input.optOutType === 'HELP') {
        return { action: 'help', meetingId }
      }

      if (target && confirms) {
        const confirmation = dalVerifySuccess(await meetingBusinessService.confirmByHomeowner(ctx, { meetingId: target.meeting.id, via: 'sms_reply' }))
        if (!confirmation.confirmed) {
          return { action: 'already_confirmed', meetingId }
        }
        const outcome = await deliverVisitText(ctx, { context: target, templateKey: 'confirmation_reply', bodies: await getTemplateBodies() })
        dalVerifySuccess(await meetingMessageCrud.create(ctx, {
          meetingId: target.meeting.id,
          kind: 'confirmation_reply',
          channel: 'sms',
          forScheduledFor: target.meeting.scheduledFor,
          status: outcome.status,
          reason: outcome.reason,
          voipMessageId: outcome.voipMessageId,
        }))
        return { action: 'confirmed', meetingId }
      }

      await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body, hasPhoto: input.mediaCount > 0 })
      return { action: 'forwarded', meetingId }
    })
  },
} as const

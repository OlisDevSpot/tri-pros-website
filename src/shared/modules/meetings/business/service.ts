import type { HomeownerConfirmation, MeetingOutcome } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'
import type { VisitEmailOutcome } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
import type { VisitMessageRunReport } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'
import type { MessagingInboundWebhookPayload } from '@/shared/services/providers/twilio/schemas/messaging'

import { publicUrl } from '@/shared/config/public-url'
import { canRescheduleFromOutcome, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { findCustomersByPhone } from '@/shared/entities/customers/dal/server/queries'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { claimHomeownerConfirmation, handOffShareToken } from '@/shared/entities/meetings/dal/server/mutations'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getRescheduleChain, getRescheduleSuccessorId } from '@/shared/entities/meetings/dal/server/queries'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'
import { formatPhone } from '@/shared/lib/phone'
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'
import { claimAutomaticSend, setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { findReplyTargetMeeting, getVisitMessageContext, listChainMessages } from '@/shared/modules/meetings/messages/dal/server/queries'
import { getTemplateBodies } from '@/shared/modules/meetings/messages/dal/server/settings'
import { deliverVisitCancellationEmail, deliverVisitSummaryEmail } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
import { deliverVisitText } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { runAutomaticKind } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'
import { shouldSendVisitCancellation } from '@/shared/modules/meetings/messages/lib/should-send-visit-cancellation'
import { notificationService } from '@/shared/services/notification.service'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

export type HomeownerReplyAction = 'opt_out' | 'opt_in' | 'help' | 'confirmed' | 'already_confirmed' | 'forwarded' | 'duplicate' | 'not_main_line'

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

      // A second reschedule would fork the chain and carry the share token to the wrong replacement.
      if (await getRescheduleSuccessorId(original.id)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'This meeting was already rescheduled; reschedule the new meeting instead.',
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
  /**
   * The setter sends the visit summary during the booking call, and staff resend it after a time change.
   * One row per leg, so a dialog can report each.
   */
  async sendVisitSummary(
    ctx: ScopedContext,
    input: { meetingId: string, note?: string | null },
  ): Promise<DalReturn<{ sms: MeetingMessage, email: MeetingMessage }>> {
    return dalDbOperation(async () => {
      // The scoped read is the visibility check; the unscoped context read is for the send.
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Visit messages go to upcoming, undecided, non-project meetings only.' })
      }
      const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
      if (!mainLine) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'No main line is configured.' })
      }

      const context = await getVisitMessageContext(meeting.id)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      const bodies = await getTemplateBodies()
      const note = input.note?.trim() || null
      const actorUserId = ctx.session?.user.id ?? null

      const text = await deliverVisitText(ctx, {
        context,
        templateKey: 'visit_summary',
        bodies,
        coordinatorNote: note,
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
        actorUserId,
        note,
      }))

      const forScheduledFor = meeting.scheduledFor
      const base = { meetingId: meeting.id, kind: 'visit_summary' as const, channel: 'email' as const, forScheduledFor, actorUserId, note }
      let email: MeetingMessage
      if (!context.customer?.email) {
        email = dalVerifySuccess(await meetingMessageCrud.create(ctx, { ...base, status: 'skipped', reason: 'no_email' }))
      }
      else {
        let outcome: VisitEmailOutcome
        try {
          const chainIds = dalVerifySuccess(await getRescheduleChain(ctx, { meetingId: meeting.id }))
          const chainMessages = await listChainMessages(chainIds)
          const sequence = chainMessages.filter(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent').length
          outcome = await deliverVisitSummaryEmail({ context, chainIds, sequence, coordinatorNote: note, mainLineE164: mainLine.e164, now: new Date() })
        }
        catch (error) {
          // The text already left; a failure here must not read as the whole summary failing, or a retry texts twice.
          console.error('[sendVisitSummary] email leg failed', { meetingId: meeting.id, error })
          outcome = { status: 'failed', reason: 'send_error', emailProviderId: null }
        }
        email = dalVerifySuccess(await meetingMessageCrud.create(ctx, { ...base, status: outcome.status, reason: outcome.reason, emailProviderId: outcome.emailProviderId }))
      }

      return { sms, email }
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

  /**
   * Removes the calendar entry of a cancelled visit whose invite went out. A reschedule's original has a
   * successor whose next summary updates the same entry, so it gets none.
   */
  async sendVisitCancellation(
    ctx: ScopedContext,
    input: { meetingId: string },
  ): Promise<DalReturn<{ sent: boolean, reason: string | null }>> {
    return dalDbOperation(async () => {
      const context = await getVisitMessageContext(input.meetingId)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (context.meeting.meetingOutcome !== 'cancelled') {
        return { sent: false, reason: 'not_cancelled' }
      }
      const chainIds = dalVerifySuccess(await getRescheduleChain(SYSTEM_CONTEXT, { meetingId: input.meetingId }))
      const chainMessages = await listChainMessages(chainIds)
      const hasSuccessor = (await getRescheduleSuccessorId(input.meetingId)) != null
      if (!shouldSendVisitCancellation({ chainMessages, hasSuccessor })) {
        return { sent: false, reason: hasSuccessor ? 'rescheduled' : 'no_invite' }
      }

      const claim = await claimAutomaticSend({ meetingId: input.meetingId, kind: 'visit_cancellation', channel: 'email', forScheduledFor: context.meeting.scheduledFor })
      if (!claim) {
        return { sent: false, reason: 'already_sent' }
      }
      const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
      if (!mainLine) {
        await setMeetingMessageOutcome(claim.id, { status: 'failed', reason: 'no_main_line' })
        return { sent: false, reason: 'no_main_line' }
      }
      const sequence = chainMessages.filter(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent').length
      const outcome = await deliverVisitCancellationEmail({ context, chainIds, sequence, mainLineE164: mainLine.e164, now: new Date() })
      await setMeetingMessageOutcome(claim.id, outcome)
      return { sent: outcome.status === 'sent', reason: outcome.reason }
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

  /**
   * A text that arrived on the main line. Every reply is stored on the thread; a reply that matches a visit
   * is recorded against it. Opt-outs come from Twilio's own verdict, never from a keyword list of ours.
   */
  async handleHomeownerReply(
    ctx: ScopedContext,
    input: { providerMessageId: string, from: string, to: string, body: string, optOutType: MessagingInboundWebhookPayload['OptOutType'] | null },
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
      if (input.optOutType === 'START') {
        // Opting back in to texts says nothing about calls, so do-not-contact stays.
        await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body })
        return { action: 'opt_in', meetingId }
      }
      if (input.optOutType === 'HELP') {
        return { action: 'help', meetingId }
      }

      if (target && matchReplyKeyword(input.body) === 'confirm') {
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

      await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body })
      return { action: 'forwarded', meetingId }
    })
  },
} as const

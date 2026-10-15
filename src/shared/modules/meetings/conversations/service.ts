import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'
import type { VisitInviteResult } from '@/shared/modules/meetings/conversations/constants/kinds'
import type { VisitMessageRunReport } from '@/shared/modules/meetings/conversations/lib/run-automatic-kind'
import type { MessagingInboundWebhookPayload } from '@/shared/services/providers/twilio/schemas/messaging'

import { publicUrl } from '@/shared/config/public-url'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { findCustomersByPhone } from '@/shared/entities/customers/dal/server/queries'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { formatPhone } from '@/shared/lib/phone'
import { meetingBusinessService } from '@/shared/modules/meetings/business/service'
import { meetingMessageCrud } from '@/shared/modules/meetings/conversations/dal/server/crud'
import { setMeetingMessageOutcome } from '@/shared/modules/meetings/conversations/dal/server/mutations'
import { findReplyTargetMeeting, getMeetingMessageByProviderMessageId, getVisitMessageContext } from '@/shared/modules/meetings/conversations/dal/server/queries'
import { getTemplateBodies } from '@/shared/modules/meetings/conversations/dal/server/settings'
import { deliverVisitText } from '@/shared/modules/meetings/conversations/lib/deliver-visit-text'
import { isVisitMessageEligible } from '@/shared/modules/meetings/conversations/lib/is-visit-message-eligible'
import { matchReplyKeyword } from '@/shared/modules/meetings/conversations/lib/match-reply-keyword'
import { runAutomaticKind } from '@/shared/modules/meetings/conversations/lib/run-automatic-kind'
import { voipMessageService } from '@/shared/modules/voip/messages/service'
import { notificationService } from '@/shared/services/notification.service'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

export type HomeownerReplyAction = 'opt_out' | 'opt_in' | 'help' | 'confirmed' | 'already_confirmed' | 'forwarded' | 'duplicate' | 'not_main_line'

export const meetingConversationService = {
  /** A text Twilio could not deliver. A summary that did not arrive means someone has to call. */
  async recordDeliveryFailure(
    _ctx: ScopedContext,
    input: { providerMessageId: string, reason: string },
  ): Promise<DalReturn<{ meetingMessageId: string | null }>> {
    return dalDbOperation(async () => {
      const message = await getMeetingMessageByProviderMessageId(input.providerMessageId)
      if (!message) {
        return { meetingMessageId: null }
      }
      await setMeetingMessageOutcome(message.id, { status: 'failed', reason: input.reason })
      if (message.kind === 'visit_summary') {
        const context = await getVisitMessageContext(message.meetingId)
        if (context) {
          await notificationService.notifyVisitTextFailed({
            meetingId: message.meetingId,
            customerName: context.customer?.name ?? 'the homeowner',
            scheduledFor: context.meeting.scheduledFor,
          })
        }
      }
      return { meetingMessageId: message.id }
    })
  },

  /**
   * The meeting welcome text. The setter sends it during the booking call, and staff resend it after a time change.
   * It also invites the homeowner to the visit's calendar event, whatever the text's outcome: the calendar sync sends
   * Google's invite. The invite is stored before the text goes: a failure while storing it leaves no text sent, so a
   * retry texts once.
   */
  async sendSummary(
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
      const from = await voipMessageService.resolveInboundSender({ from: input.from, voipDidId: did?.id ?? null })
      const matched = dalVerifySuccess(await findCustomersByPhone(from))
      const recorded = dalVerifySuccess(await voipMessageService.recordInboundMessage(ctx, {
        providerMessageId: input.providerMessageId,
        voipDidId: did?.id ?? null,
        customerId: matched[0]?.id ?? null,
        remoteE164: from,
        body: input.body,
      }))

      const target = await findReplyTargetMeeting({ customerIds: matched.map(customer => customer.id), now: new Date() })
      const meetingId = target?.meeting.id ?? null
      const scheduledFor = target?.meeting.scheduledFor ?? null
      const customerName = target?.customer?.name ?? matched[0]?.name ?? formatPhone(from)

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

export type MeetingConversationService = typeof meetingConversationService

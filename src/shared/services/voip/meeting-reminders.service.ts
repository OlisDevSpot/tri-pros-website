import type { DalReturn } from '@/shared/dal/server/types'
import type { ReminderCandidate } from '@/shared/entities/meetings/dal/server/queries'
import type { ReminderReplyIntent } from '@/shared/services/voip/lib/meeting-sms-templates'

import { dalSuccess, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { claimReminderSend, releaseReminderClaim } from '@/shared/entities/meetings/dal/server/mutations'
import { findNextMeetingByCustomerPhone, getReminderTargetByMeetingId, listReminderCandidates } from '@/shared/entities/meetings/dal/server/queries'
import { addCalendarDays, businessToday } from '@/shared/lib/business-time'
import { toE164 } from '@/shared/lib/phone'
import { getMessagingServiceSid } from '@/shared/services/providers/twilio/constants'
import {
  bookingConfirmationBody,
  classifyReminderReply,
  confirmedReplyBody,
  dayBeforeReminderBody,
  rescheduleReplyBody,
} from '@/shared/services/voip/lib/meeting-sms-templates'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

// Pure orchestration: meetings DAL + templates + voipMessagesService. Every send runs
// under SYSTEM_CONTEXT because no agent is acting; the compliance gate, 10DLC gate and
// dev-override all live one layer down in voipMessagesService.sendLifecycleSms.

export type ReminderSkipReason = 'unconfigured' | 'no-target' | 'bad-phone' | 'already-claimed'

export interface ReminderBatchSummary {
  dayKey: string
  candidates: number
  sent: number
  failed: number
  skipped: number
}

export interface InboundReplyOutcome {
  intent: ReminderReplyIntent
  // TwiML reply for the customer; null means stay silent and let a human follow up.
  replyBody: string | null
  meetingId: string | null
}

function smsVars(target: Pick<ReminderCandidate, 'customerName' | 'ownerName' | 'scheduledFor'>) {
  return { customerName: target.customerName, agentName: target.ownerName, scheduledFor: target.scheduledFor }
}

function createMeetingRemindersService() {
  return {
    /** Feature gate: the whole lifecycle-SMS surface is off until the Messaging Service SID is set. */
    isEnabled: (): boolean => Boolean(getMessagingServiceSid()),

    /** Fired from meetings.create.after via QStash. Idempotent per QStash retry only in the sense that a duplicate text is harmless; the row is not marked. */
    sendBookingConfirmation: async (input: { meetingId: string }): Promise<DalReturn<{ skipped: ReminderSkipReason | null }>> => {
      if (!getMessagingServiceSid()) {
        return dalSuccess({ skipped: 'unconfigured' as const })
      }
      const target = await getReminderTargetByMeetingId(input.meetingId)
      if (!target.success) {
        return target
      }
      if (!target.data) {
        return dalSuccess({ skipped: 'no-target' as const })
      }
      const toE164Phone = toE164(target.data.customerPhone)
      if (!toE164Phone) {
        return dalSuccess({ skipped: 'bad-phone' as const })
      }
      const sent = await voipMessagesService.sendLifecycleSms(SYSTEM_CONTEXT, {
        customerId: target.data.customerId,
        remoteE164: toE164Phone,
        body: bookingConfirmationBody(smsVars(target.data)),
      })
      if (!sent.success) {
        return sent
      }
      return dalSuccess({ skipped: null })
    },

    /**
     * The 6 pm batch. Defaults to tomorrow in the business timezone. Each row is claimed
     * (reminderSentAt set) BEFORE the Twilio call so a retry mid-batch cannot double-text;
     * a Twilio rejection releases the claim so the next run picks the meeting up again.
     */
    sendDayBeforeReminders: async (input: { dayKey?: string } = {}): Promise<DalReturn<ReminderBatchSummary>> => {
      const dayKey = input.dayKey ?? addCalendarDays(businessToday(), 1)
      const summary: ReminderBatchSummary = { dayKey, candidates: 0, sent: 0, failed: 0, skipped: 0 }

      if (!getMessagingServiceSid()) {
        console.warn('[meeting-reminders] TWILIO_MESSAGING_SERVICE_SID unset — batch skipped')
        return dalSuccess(summary)
      }

      const candidates = await listReminderCandidates(dayKey)
      if (!candidates.success) {
        return candidates
      }
      summary.candidates = candidates.data.length

      // Sequential on purpose: Twilio's per-number throughput is ~1 msg/s and QStash gives the
      // job up to maxDuration; a same-day batch is tens of rows, not thousands.
      for (const target of candidates.data) {
        const toE164Phone = toE164(target.customerPhone)
        if (!toE164Phone) {
          summary.skipped += 1
          continue
        }
        const claimed = await claimReminderSend(target.meetingId)
        if (!claimed.success || !claimed.data) {
          summary.skipped += 1
          continue
        }
        const sent = await voipMessagesService.sendLifecycleSms(SYSTEM_CONTEXT, {
          customerId: target.customerId,
          remoteE164: toE164Phone,
          body: dayBeforeReminderBody(smsVars(target)),
        })
        if (sent.success && sent.data.status === 'sent') {
          summary.sent += 1
          continue
        }
        summary.failed += 1
        // A DNC'd customer must not be retried tomorrow; keep that claim. Anything else (Twilio outage, transport) releases.
        const isDnc = sent.success && sent.data.failureReason === 'dnc'
        if (!isDnc) {
          await releaseReminderClaim(target.meetingId)
        }
        console.error('[meeting-reminders] send failed', { meetingId: target.meetingId, result: sent })
      }

      console.warn('[meeting-reminders] batch complete', summary)
      return dalSuccess(summary)
    },

    /**
     * Applies a customer's text reply to their soonest upcoming meeting. Confirmation goes
     * through meetingCrud.update so the Ably broadcast lights the agent's screen live.
     */
    handleInboundReply: async (input: { fromE164: string, body: string }): Promise<DalReturn<InboundReplyOutcome>> => {
      const intent = classifyReminderReply(input.body)
      if (intent === 'other') {
        return dalSuccess({ intent, replyBody: null, meetingId: null })
      }

      const meeting = await findNextMeetingByCustomerPhone(input.fromE164)
      if (!meeting.success) {
        return meeting
      }
      if (!meeting.data) {
        return dalSuccess({ intent, replyBody: null, meetingId: null })
      }
      const target = meeting.data

      if (intent === 'reschedule') {
        return dalSuccess({ intent, replyBody: rescheduleReplyBody({ agentName: target.ownerName }), meetingId: target.meetingId })
      }

      if (!target.confirmedAt) {
        const updated = await meetingCrud.update(SYSTEM_CONTEXT, {
          id: target.meetingId,
          data: { confirmedAt: new Date().toISOString() },
        })
        if (!updated.success) {
          return updated
        }
      }
      return dalSuccess({ intent, replyBody: confirmedReplyBody(smsVars(target)), meetingId: target.meetingId })
    },
  }
}

export const meetingRemindersService = createMeetingRemindersService()

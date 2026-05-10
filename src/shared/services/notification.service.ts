import type { ContractEvent } from '@/shared/constants/enums'
import { eq } from 'drizzle-orm'
import { ROOTS } from '@/shared/config/roots'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { sendPushToUser } from '@/shared/services/push/send'
import { resendClient } from '@/shared/services/resend/client'
import { RESEND_FROM } from '@/shared/services/resend/constants'
import { renderProposalViewedEmail } from '@/shared/services/resend/lib/render-emails'

function createNotificationService() {
  return {
    /**
     * Stub. Wired from the Zoho Sign webhook job; logs the event so we can
     * confirm wiring. Real dispatch lands with the notifications overhaul.
     */
    notifyContractStatusChange: async (params: {
      event: ContractEvent
      proposalOwnerId: string
      proposalId: string
      occurredAt: string
    }) => {
      console.warn(`[notificationService] notifyContractStatusChange:${params.event} (stub)`, params)
    },

    notifyProposalViewed: async (params: {
      proposalOwnerId: string
      proposalLabel: string
      proposalId: string
      customerName: string
      viewedAt: string
      source: string
    }) => {
      const [owner] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, params.proposalOwnerId))
      if (!owner?.email) {
        return
      }

      const sourceLabels: Record<string, string> = {
        email: 'Opened from email link',
        sms: 'Opened from SMS link',
        direct: 'Opened directly',
        unknown: 'Opened directly',
      }
      const sourceLabel = sourceLabels[params.source] ?? 'Opened directly'

      const { error } = await resendClient.emails.send({
        from: RESEND_FROM.default,
        to: owner.email,
        subject: `🔔 ${params.customerName} just opened their proposal`,
        react: renderProposalViewedEmail({
          customerName: params.customerName,
          proposalLabel: params.proposalLabel,
          viewedAt: params.viewedAt,
          sourceLabel,
          proposalId: params.proposalId,
        }),
      })

      if (error) {
        console.error(`[notificationService] Failed to notify proposal viewed:`, error)
      }
    },

    // Fires when an internal user is added/promoted as a participant on a
    // meeting they didn't create. Push deep-links to the same URL as the
    // "View in Schedule" entity action (use-meeting-action-configs.tsx) so
    // tapping the notification lands them at the meeting on the schedule
    // page with the row highlighted.
    //
    // Caller is responsible for skipping self-additions. We don't have the
    // actor on this signature on purpose — the call site already knows
    // whether `participantUserId === ctx.session.user.id` and can short-
    // circuit before calling us, which avoids leaking actor concerns into
    // the notification layer.
    notifyMeetingParticipantAdded: async (params: {
      meetingId: string
      participantUserId: string
    }) => {
      const [meeting] = await db
        .select({
          id: meetings.id,
          scheduledFor: meetings.scheduledFor,
          customerName: customers.name,
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .where(eq(meetings.id, params.meetingId))
        .limit(1)

      if (!meeting) {
        console.warn(`[notificationService] notifyMeetingParticipantAdded: meeting ${params.meetingId} not found`)
        return
      }

      const navigate = ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, meeting.scheduledFor)

      const customerLabel = meeting.customerName ? ` for ${meeting.customerName}` : ''
      const title = `You've been added to a meeting${customerLabel}`
      const body = meeting.scheduledFor
        ? new Date(meeting.scheduledFor).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Los_Angeles',
          })
        : 'Tap to view'

      const result = await sendPushToUser(params.participantUserId, {
        title,
        body,
        navigate,
        urgency: 'high',
      })

      if (result.failed > 0 || result.errors.length > 0) {
        console.warn(`[notificationService] notifyMeetingParticipantAdded partial failure:`, result)
      }
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
export const notificationService = createNotificationService()

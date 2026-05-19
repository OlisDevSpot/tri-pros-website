import type { ContractEvent } from '@/shared/constants/enums'
import { and, eq, ne } from 'drizzle-orm'
import { ROOTS } from '@/shared/config/roots'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { sendPushToUser, sendPushToUsers } from '@/shared/services/providers/web-push/send'

// @migration(meetings-entity-router)
// This service still imports `db` for the meeting notification methods
// (notifyMeetingParticipantAdded, notifyMeetingScheduledTimeChanged).
// Once the meetings router migrates to entity toolkit:
// - Callers pass pre-assembled params (customer name, address, recipients)
// - The `db` import and all direct queries are removed
// - This service becomes a pure formatter + push/email dispatcher

// iOS lock-screen titles truncate around 30-40 chars. Front-load the event
// type + customer identity so the truncated form still tells the user what
// the notification is about. Format: "<EventType> | <Customer>".
//
// Customer label includes the street address when available because two
// agents may have multiple meetings with similarly-named customers — the
// address disambiguates without forcing the user to open the notification.
function buildCustomerLabel(customer: { name: string | null, address: string | null }): string {
  const name = customer.name ?? 'Unknown customer'
  return customer.address ? `${name}, ${customer.address}` : name
}

const PT_DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Los_Angeles',
}

function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', PT_DATE_FMT)
}

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
      const sourceLabels: Record<string, string> = {
        email: 'Opened from email link',
        sms: 'Opened from SMS link',
        direct: 'Opened directly',
        unknown: 'Opened directly',
      }
      const sourceLabel = sourceLabels[params.source] ?? 'Opened directly'

      // Push (always sent when owner has an active subscription).
      const pushResult = await sendPushToUser(params.proposalOwnerId, {
        title: `Proposal Viewed | ${params.customerName}`,
        body: `${sourceLabel} • ${formatScheduledTime(params.viewedAt)}`,
        navigate: ROOTS.dashboard.proposals.byId(params.proposalId),
        urgency: 'high',
      })
      if (pushResult.failed > 0 || pushResult.errors.length > 0) {
        console.warn(`[notificationService] notifyProposalViewed push partial failure:`, pushResult)
      }

      // @migration(user-email-preferences)
      // Email notification for proposal views was disabled pending user
      // preference system (issue #188). When that ships:
      // 1. Caller passes `ownerEmail` in params (already available on session)
      // 2. Check user preference via DAL query or params
      // 3. Send email using ownerEmail — no db lookup needed here
    },

    // Fires when an internal user is added/promoted as a participant on a
    // meeting they didn't create. Push deep-links to the same URL as the
    // "View in Schedule" entity action so tapping the notification lands
    // them at the meeting on the schedule page with the row highlighted.
    //
    // Caller is responsible for skipping self-additions. We don't have the
    // actor on this signature on purpose — the call site already knows
    // whether `participantUserId === ctx.session.user.id` and can short-
    // circuit before calling us.
    //
    // @migration(meetings-entity-router)
    // Once meetings migrates: caller passes { customerName, customerAddress,
    // scheduledFor } in params. Remove the db query below.
    notifyMeetingParticipantAdded: async (params: {
      meetingId: string
      participantUserId: string
    }) => {
      const [meeting] = await db
        .select({
          id: meetings.id,
          scheduledFor: meetings.scheduledFor,
          customerName: customers.name,
          customerAddress: customers.address,
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
      const title = `New Meeting | ${buildCustomerLabel({ name: meeting.customerName, address: meeting.customerAddress })}`
      const body = meeting.scheduledFor ? formatScheduledTime(meeting.scheduledFor) : 'Tap to view'

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

    // Fires when a meeting's scheduledFor is changed (rescheduled, newly
    // scheduled, or unscheduled). Sent to every participant EXCEPT the
    // actor — so if the owner moves their own meeting, the co-owner gets
    // pinged but the owner does not. Skip is enforced inside this function
    // (vs at the call site like the participant-added path) because the
    // recipients are derived here and the actor is the only signal the
    // caller has to suppress.
    //
    // @migration(meetings-entity-router)
    // Once meetings migrates: caller passes { recipientUserIds, customerName,
    // customerAddress } in params. Remove both db queries below.
    notifyMeetingScheduledTimeChanged: async (params: {
      meetingId: string
      newScheduledFor: string | null
      oldScheduledFor: string | null
      excludeUserId: string
    }) => {
      const [meeting] = await db
        .select({
          id: meetings.id,
          customerName: customers.name,
          customerAddress: customers.address,
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .where(eq(meetings.id, params.meetingId))
        .limit(1)

      if (!meeting) {
        console.warn(`[notificationService] notifyMeetingScheduledTimeChanged: meeting ${params.meetingId} not found`)
        return
      }

      const recipients = await db
        .select({ userId: meetingParticipants.userId })
        .from(meetingParticipants)
        .where(and(
          eq(meetingParticipants.meetingId, params.meetingId),
          ne(meetingParticipants.userId, params.excludeUserId),
        ))

      if (recipients.length === 0) {
        return
      }

      const navigate = ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, params.newScheduledFor)
      const customerLabel = buildCustomerLabel({ name: meeting.customerName, address: meeting.customerAddress })

      // Body shape depends on the kind of change:
      //   set → set : "Mon May 12 2:30 PM → Tue May 13 3:00 PM"
      //   null → set: "Now Tue May 13 3:00 PM"
      //   set → null: "No longer scheduled"
      let body: string
      if (params.newScheduledFor && params.oldScheduledFor) {
        body = `${formatScheduledTime(params.oldScheduledFor)} → ${formatScheduledTime(params.newScheduledFor)}`
      }
      else if (params.newScheduledFor) {
        body = `Now ${formatScheduledTime(params.newScheduledFor)}`
      }
      else {
        body = 'No longer scheduled'
      }

      const title = `Time Changed | ${customerLabel}`

      const result = await sendPushToUsers(
        recipients.map(r => r.userId),
        {
          title,
          body,
          navigate,
          urgency: 'high',
        },
      )

      if (result.failed > 0 || result.errors.length > 0) {
        console.warn(`[notificationService] notifyMeetingScheduledTimeChanged partial failure:`, result)
      }
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
export const notificationService = createNotificationService()

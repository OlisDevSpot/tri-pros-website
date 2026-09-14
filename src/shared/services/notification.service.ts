import type { ContractEvent } from '@/shared/constants/enums'
import { ROOTS } from '@/shared/config/roots'
import { NEW_LEAD_NOTIFICATION_EMAILS } from '@/shared/constants/company/new-lead-notifications'
import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { getUserIdsByEmails } from '@/shared/entities/users/dal/server/queries'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { emailService } from '@/shared/services/email.service'
import { webPushClient } from '@/shared/services/providers/web-push/client'

// Layering: this service never touches `db` — every lookup it still performs
// (customer for a new lead, meeting + customer for the meeting pushes, meeting
// participants, user ids for a recipient email list) rings a DAL read under
// SYSTEM_CONTEXT. see docs/codebase-conventions/service-architecture.md
//
// @migration(meetings-entity-router)
// Direction of travel: callers pass pre-assembled params (customer name,
// address, recipients) and the lookups below disappear, leaving a pure
// formatter + push/email dispatcher.

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

    /**
     * Generic new-lead alert (push + email) — source-agnostic: funnels today,
     * webhooks/manual intake tomorrow. Recipients: NEW_LEAD_NOTIFICATION_EMAILS.
     */
    notifyNewLead: async (params: { customerId: string, source: string }) => {
      const customer = dalVerifySuccess(await customerCrud.getById(SYSTEM_CONTEXT, { id: params.customerId }))
      if (!customer) {
        console.warn(`[notificationService] notifyNewLead: customer ${params.customerId} not found`)
        return
      }

      const emails = [...NEW_LEAD_NOTIFICATION_EMAILS]
      const recipientUserIds = dalVerifySuccess(await getUserIdsByEmails(emails))

      const name = customer.name ?? 'Unknown'
      const locationLabel = [customer.city, customer.zip].filter(Boolean).join(' ')
      const body = locationLabel ? `${params.source} · ${locationLabel}` : params.source

      const pushResult = await webPushClient.sendToUsers(
        recipientUserIds,
        {
          title: `New Lead | ${name}`,
          body,
          navigate: ROOTS.dashboard.customers.root(),
          urgency: 'high',
        },
      )
      if (pushResult.failed > 0 || pushResult.errors.length > 0) {
        console.warn(`[notificationService] notifyNewLead push partial failure:`, pushResult)
      }

      await emailService.sendNewLeadNotificationEmail({
        to: emails,
        name,
        phone: customer.phone,
        city: customer.city,
        zip: customer.zip,
        source: params.source,
      })
    },

    /**
     * The homeowner clicked "Request Agreement" on their proposal review
     * page. A pure SIGNAL to the agents — the homeowner never touches the
     * contract lifecycle; the agent prepares/sends the signing draft
     * manually. Recipients: the proposal's meeting participants (all of
     * them) PLUS the info@ system user — always. A proposal has no owner
     * (2026-09-10 ruling; `ownerId` is the author, never a recipient).
     * see `src/shared/modules/proposals/core/DOCS.md#proposal-lock-ladder`
     * see `src/shared/modules/proposals/core/DOCS.md#shareable-via-token`
     *
     * @migration(meetings-entity-router)
     * Same deal as the meeting methods below — recipients are resolved here
     * (DAL reads) until meetings migrates; then callers pass recipients.
     */
    notifyHomeownerMoveForwardRequest: async (params: {
      proposalId: string
      proposalLabel: string
      meetingId: string | null
      customerName: string
    }) => {
      const recipients: { userId: string, email: string }[] = params.meetingId
        ? (await getParticipantsForMeeting(params.meetingId)).map(p => ({ userId: p.userId, email: p.userEmail }))
        : []
      const systemOwnerId = await getSystemOwnerId()
      if (!recipients.some(r => r.userId === systemOwnerId)) {
        recipients.push({ userId: systemOwnerId, email: SYSTEM_OWNER_EMAIL })
      }

      // Push to every recipient's active subscriptions (participants + info@).
      const pushResult = await webPushClient.sendToUsers(
        recipients.map(r => r.userId),
        {
          title: `Ready to Move Forward | ${params.customerName}`,
          body: 'Homeowner requested their agreement — prepare the signing draft',
          navigate: ROOTS.dashboard.proposals.byId(params.proposalId),
          urgency: 'high',
        },
      )
      if (pushResult.failed > 0 || pushResult.errors.length > 0) {
        console.warn(`[notificationService] notifyHomeownerMoveForwardRequest push partial failure:`, pushResult)
      }

      // Blast the whole team: every meeting participant PLUS the company inbox
      // (info@). Dedupe case-insensitively so the owner-is-info@ case doesn't
      // send twice.
      const seen = new Set<string>()
      const emailRecipients: string[] = []
      for (const email of [...recipients.map(r => r.email), SYSTEM_OWNER_EMAIL]) {
        const key = email.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          emailRecipients.push(email)
        }
      }

      await emailService.sendMoveForwardRequestEmail({
        recipients: emailRecipients,
        customerName: params.customerName,
        proposalLabel: params.proposalLabel,
        proposalId: params.proposalId,
      })
    },

    /**
     * The homeowner opened their proposal. Recipients are the proposal's
     * meeting participants — ALL of them — resolved by the caller
     * (`proposalService.views.record`); a proposal has no owner to notify.
     * see `src/shared/modules/proposals/core/DOCS.md#shareable-via-token`
     */
    notifyProposalViewed: async (params: {
      recipientUserIds: string[]
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

      // Push to every recipient's active subscriptions (no-op for an empty list).
      const pushResult = await webPushClient.sendToUsers(params.recipientUserIds, {
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
      // 1. Caller passes the recipients' emails in params (the meetings DAL
      //    read that resolves `recipientUserIds` already joins `user`)
      // 2. Check each user's preference via DAL query or params
      // 3. Send email to the opted-in recipients — no db lookup needed here
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
    // scheduledFor } in params. Remove the DAL read below.
    notifyMeetingParticipantAdded: async (params: {
      meetingId: string
      participantUserId: string
    }) => {
      const meeting = dalVerifySuccess(await getByIdWithJoins(SYSTEM_CONTEXT, { id: params.meetingId }))
      if (!meeting) {
        console.warn(`[notificationService] notifyMeetingParticipantAdded: meeting ${params.meetingId} not found`)
        return
      }

      const navigate = ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, meeting.scheduledFor)
      const title = `New Meeting | ${buildCustomerLabel({ name: meeting.customer?.name ?? null, address: meeting.customer?.address ?? null })}`
      const body = meeting.scheduledFor ? formatScheduledTime(meeting.scheduledFor) : 'Tap to view'

      const result = await webPushClient.sendToUser(params.participantUserId, {
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
    // customerAddress } in params. Remove both DAL reads below.
    notifyMeetingScheduledTimeChanged: async (params: {
      meetingId: string
      newScheduledFor: string | null
      oldScheduledFor: string | null
      /**
       * Skip notifying this user. Optional so SYSTEM_CONTEXT callers
       * (e.g., inbound GCal sync) can notify every participant — there
       * is no "actor" to exclude in those flows.
       */
      excludeUserId?: string
    }) => {
      const meeting = dalVerifySuccess(await getByIdWithJoins(SYSTEM_CONTEXT, { id: params.meetingId }))
      if (!meeting) {
        console.warn(`[notificationService] notifyMeetingScheduledTimeChanged: meeting ${params.meetingId} not found`)
        return
      }

      // Every participant except the actor (no actor ⇒ everyone).
      const recipients = (await getParticipantsForMeeting(params.meetingId))
        .filter(p => p.userId !== params.excludeUserId)

      if (recipients.length === 0) {
        return
      }

      const navigate = ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, params.newScheduledFor)
      const customerLabel = buildCustomerLabel({ name: meeting.customer?.name ?? null, address: meeting.customer?.address ?? null })

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

      const result = await webPushClient.sendToUsers(
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

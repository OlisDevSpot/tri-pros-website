import type { ContractEvent } from '@/shared/constants/enums'
import { ROOTS } from '@/shared/config/roots'
import { NEW_LEAD_NOTIFICATION_EMAILS } from '@/shared/constants/company/new-lead-notifications'
import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { getUserIdsByEmails } from '@/shared/entities/users/dal/server/queries'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { emailService } from '@/shared/services/email.service'
import { webPushClient } from '@/shared/services/providers/web-push/client'

// @migration(meetings-entity-router): callers will pass pre-assembled params and the DAL reads below disappear.

// iOS lock-screen titles truncate around 30-40 chars, so titles front-load "<EventType> | <Customer>"; the address disambiguates similarly-named customers.
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
    /** Stub — real dispatch lands with the notifications overhaul. */
    notifyContractStatusChange: async (params: {
      event: ContractEvent
      proposalOwnerId: string
      proposalId: string
      occurredAt: string
    }) => {
      console.warn(`[notificationService] notifyContractStatusChange:${params.event} (stub)`, params)
    },

    notifyNewLead: async (params: { customerId: string, source: string }) => {
      const customer = dalVerifySuccess(await customerCrud.getById(systemContext('derived:new-lead-notification'), { id: params.customerId }))
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

    /** Recipients are every meeting participant plus info@ — never `ownerId`, which is the author, not an owner. */
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

      const pushResult = await webPushClient.sendToUsers(params.recipientUserIds, {
        title: `Proposal Viewed | ${params.customerName}`,
        body: `${sourceLabel} • ${formatScheduledTime(params.viewedAt)}`,
        navigate: ROOTS.dashboard.proposals.byId(params.proposalId),
        urgency: 'high',
      })
      if (pushResult.failed > 0 || pushResult.errors.length > 0) {
        console.warn(`[notificationService] notifyProposalViewed push partial failure:`, pushResult)
      }

      // @migration(user-email-preferences): email for proposal views is disabled until the user preference system ships (#188).
    },

    // The caller skips self-additions — the actor is deliberately not on this signature.
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

    // Unlike participant-added, the actor skip lives here because the recipients are derived here.
    notifyMeetingScheduledTimeChanged: async (params: {
      meetingId: string
      newScheduledFor: string | null
      oldScheduledFor: string | null
      /** Optional so SYSTEM_CONTEXT callers (inbound GCal sync) notify everyone — there is no actor to exclude. */
      excludeUserId?: string
    }) => {
      const meeting = dalVerifySuccess(await getByIdWithJoins(SYSTEM_CONTEXT, { id: params.meetingId }))
      if (!meeting) {
        console.warn(`[notificationService] notifyMeetingScheduledTimeChanged: meeting ${params.meetingId} not found`)
        return
      }

      const recipients = (await getParticipantsForMeeting(params.meetingId))
        .filter(p => p.userId !== params.excludeUserId)

      if (recipients.length === 0) {
        return
      }

      const navigate = ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, params.newScheduledFor)
      const customerLabel = buildCustomerLabel({ name: meeting.customer?.name ?? null, address: meeting.customer?.address ?? null })

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

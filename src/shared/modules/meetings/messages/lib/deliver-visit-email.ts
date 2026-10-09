import type { VisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import type { VisitCancellationEmailProps } from '@/shared/services/providers/resend/emails/visit-cancellation-email'
import type { VisitSummaryEmailProps } from '@/shared/services/providers/resend/emails/visit-summary-email'

import { publicUrl } from '@/shared/config/public-url'
import { APP_HOSTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { MEETING_ESTIMATED_DURATION_MS } from '@/shared/entities/meetings/constants/scheduling'
import { formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { formatCustomerAddress } from '@/shared/lib/formatters'
import { formatPhone } from '@/shared/lib/phone'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
import { displayFirstName, visitLinkFor } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { buildGoogleCalendarLink } from '@/shared/modules/meetings/messages/lib/google-calendar-link'
import { emailService } from '@/shared/services/email.service'
import { RESEND_LEAD_INBOX } from '@/shared/services/providers/resend/constants'

export interface VisitEmailOutcome {
  status: 'sent' | 'failed'
  reason: string | null
  emailProviderId: string | null
}

const PROD_ID = `-//${companyInfo.name}//Home Visit//EN`

function eventSummary(): string {
  return `Home visit with ${companyInfo.name}`
}

/** The calendar entry for a visit. One UID per reschedule chain, so a resend updates the entry instead of adding one. */
export function buildVisitInvite(input: {
  context: VisitMessageContext
  /** Oldest first; the first id names the entry for the life of the chain. */
  chainIds: string[]
  sequence: number
  method: 'REQUEST' | 'CANCEL'
  now: Date
}): string {
  const { meeting, customer, rep } = input.context
  const visitUrl = visitLinkFor(meeting)
  const address = customer
    ? formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })
    : null
  return buildIcs({
    method: input.method,
    prodId: PROD_ID,
    uid: `${input.chainIds[0] ?? meeting.id}@${APP_HOSTS.prod[0]}`,
    sequence: input.sequence,
    start: meeting.scheduledFor,
    durationMs: MEETING_ESTIMATED_DURATION_MS,
    summary: eventSummary(),
    description: `${displayFirstName(rep) ?? 'Your specialist'} from ${companyInfo.name} will arrive between ${formatArrivalWindow(meeting.scheduledFor)}.\nYour visit details: ${visitUrl}`,
    location: address?.hasAddress ? address.singleLine : undefined,
    url: visitUrl,
    organizer: { name: companyInfo.name, email: RESEND_LEAD_INBOX },
    attendee: { name: customer?.name ?? '', email: customer?.email ?? '' },
    now: input.now,
  })
}

export function buildVisitSummaryEmailProps(input: {
  context: VisitMessageContext
  coordinatorNote: string | null
  mainLineE164: string
}): VisitSummaryEmailProps {
  const { meeting, customer, rep, coordinator } = input.context
  const visitUrl = visitLinkFor(meeting)
  const address = customer
    ? formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })
    : null
  return {
    firstName: customer?.name.trim().split(/\s+/)[0] || 'there',
    specialistName: displayFirstName(rep),
    coordinatorName: displayFirstName(coordinator),
    visitDayTime: formatBusinessDayTime(meeting.scheduledFor),
    arrivalWindow: formatArrivalWindow(meeting.scheduledFor),
    addressLine1: address?.line1 ?? '',
    addressLine2: address?.line2 ?? '',
    visitUrl,
    googleCalendarUrl: buildGoogleCalendarLink({
      summary: eventSummary(),
      start: meeting.scheduledFor,
      durationMs: MEETING_ESTIMATED_DURATION_MS,
      location: address?.hasAddress ? address.singleLine : undefined,
      description: `Your visit details: ${visitUrl}`,
    }),
    coordinatorNote: input.coordinatorNote,
    mainLinePhone: formatPhone(input.mainLineE164),
    companyName: companyInfo.name,
    logoUrl: publicUrl('/company/logo/logo-light-right.jpg'),
  }
}

/** Sends the summary email with its invite. The caller records the outcome. */
export async function deliverVisitSummaryEmail(input: {
  context: VisitMessageContext
  chainIds: string[]
  /** How many summary emails the chain already sent; the invite's SEQUENCE. */
  sequence: number
  coordinatorNote: string | null
  mainLineE164: string
  now: Date
}): Promise<VisitEmailOutcome> {
  const { meeting, customer } = input.context
  if (!customer?.email) {
    return { status: 'failed', reason: 'no_email', emailProviderId: null }
  }
  const props = buildVisitSummaryEmailProps({ context: input.context, coordinatorNote: input.coordinatorNote, mainLineE164: input.mainLineE164 })
  try {
    const { buildVisitSummaryText } = await import('@/shared/services/providers/resend/emails/visit-summary-email')
    const { id } = await emailService.sendVisitSummaryEmail({
      to: customer.email,
      coordinatorName: props.coordinatorName,
      visitDay: formatBusinessDay(meeting.scheduledFor),
      props,
      text: buildVisitSummaryText(props),
      ics: buildVisitInvite({ context: input.context, chainIds: input.chainIds, sequence: input.sequence, method: 'REQUEST', now: input.now }),
    })
    return { status: 'sent', reason: null, emailProviderId: id }
  }
  catch (error) {
    console.error('[deliverVisitSummaryEmail] send failed', { meetingId: meeting.id, error })
    return { status: 'failed', reason: 'send_error', emailProviderId: null }
  }
}

/** Sends the calendar cancellation. `sequence` is how many summary emails the chain sent, so the update outranks the last one. */
export async function deliverVisitCancellationEmail(input: {
  context: VisitMessageContext
  chainIds: string[]
  sequence: number
  mainLineE164: string
  now: Date
}): Promise<VisitEmailOutcome> {
  const { meeting, customer, coordinator } = input.context
  if (!customer?.email) {
    return { status: 'failed', reason: 'no_email', emailProviderId: null }
  }
  const props: VisitCancellationEmailProps = {
    firstName: customer.name.trim().split(/\s+/)[0] || 'there',
    visitDayTime: formatBusinessDayTime(meeting.scheduledFor),
    mainLinePhone: formatPhone(input.mainLineE164),
    companyName: companyInfo.name,
    logoUrl: publicUrl('/company/logo/logo-light-right.jpg'),
  }
  try {
    const { buildVisitCancellationText } = await import('@/shared/services/providers/resend/emails/visit-cancellation-email')
    const { id } = await emailService.sendVisitCancellationEmail({
      to: customer.email,
      coordinatorName: displayFirstName(coordinator),
      visitDay: formatBusinessDay(meeting.scheduledFor),
      props,
      text: buildVisitCancellationText(props),
      ics: buildVisitInvite({ context: input.context, chainIds: input.chainIds, sequence: input.sequence, method: 'CANCEL', now: input.now }),
    })
    return { status: 'sent', reason: null, emailProviderId: id }
  }
  catch (error) {
    console.error('[deliverVisitCancellationEmail] send failed', { meetingId: meeting.id, error })
    return { status: 'failed', reason: 'send_error', emailProviderId: null }
  }
}

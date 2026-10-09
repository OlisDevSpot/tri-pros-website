import type { ScopedContext } from '@/shared/dal/server/types'
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'

import { publicUrl } from '@/shared/config/public-url'
import { ROOTS } from '@/shared/config/roots'
import { hasOutboundOnThread } from '@/shared/entities/voip-messages/dal/server/queries'
import { toE164 } from '@/shared/lib/phone'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

export interface VisitTextOutcome {
  status: 'sent' | 'failed' | 'skipped'
  reason: string | null
  voipMessageId: string | null
}

// Twilio refuses a send to a number that opted out at the carrier; that is do-not-contact, not a fault.
const TWILIO_OPTED_OUT = 'twilio:21610'

export function visitLinkFor(meeting: Pick<VisitMessageContext['meeting'], 'id' | 'shareToken'>): string {
  return publicUrl(ROOTS.public.homeVisit(meeting.id, meeting.shareToken))
}

/** Homeowner copy names a person by nickname, else first name; null when there is nobody to name. */
export function displayFirstName(person: { name: string, nickname: string | null } | null): string | null {
  if (!person) {
    return null
  }
  return person.nickname?.trim() || person.name.trim().split(/\s+/)[0] || null
}

/**
 * Renders one visit text from the current wording and sends it from the main line. The caller records
 * the outcome: the summary inserts its row, a run finishes its claim.
 */
export async function deliverVisitText(ctx: ScopedContext, input: {
  context: VisitMessageContext
  templateKey: VisitMessageTemplateKey
  bodies: Record<VisitMessageTemplateKey, string>
  coordinatorNote?: string | null
  mediaUrl?: string[]
}): Promise<VisitTextOutcome> {
  const { meeting, customer, rep, coordinator } = input.context
  const remoteE164 = toE164(customer?.phone)
  if (!customer || !remoteE164) {
    return { status: 'skipped', reason: 'no_phone', voipMessageId: null }
  }

  const mainLine = await voipDidsService.getMainLineDid()
  if (!mainLine.success || !mainLine.data) {
    return { status: 'failed', reason: 'no_main_line', voipMessageId: null }
  }

  // The summary is the first text a homeowner gets, and always carries the opt-out; the lookup only matters for the rest.
  const stopLine = input.templateKey === 'visit_summary' || !(await hasOutboundOnThread({ voipDidId: mainLine.data.id, remoteE164 }))
  const body = renderVisitMessage(
    input.bodies[input.templateKey],
    buildVisitMessageVars({
      customerName: customer.name,
      specialistName: displayFirstName(rep),
      coordinatorName: displayFirstName(coordinator),
      scheduledFor: meeting.scheduledFor,
      visitLink: visitLinkFor(meeting),
      coordinatorNote: input.coordinatorNote,
    }),
    { stopLine },
  )

  const sent = await voipMessagesService.sendFromMainLine(ctx, { customerId: customer.id, remoteE164, body, mediaUrl: input.mediaUrl })
  if (!sent.success) {
    console.error('[deliverVisitText] send refused', { meetingId: meeting.id, error: sent.error })
    // A refusal means texting is switched off (no 10DLC approval, or no dev override), not that this send broke.
    return { status: 'failed', reason: sent.error.type === 'precondition-failed' ? 'sms_disabled' : 'send_error', voipMessageId: null }
  }
  const { messageId, status, failureReason } = sent.data
  if (status === 'sent') {
    return { status: 'sent', reason: null, voipMessageId: messageId }
  }
  if (failureReason === 'dnc' || failureReason === TWILIO_OPTED_OUT) {
    return { status: 'skipped', reason: 'dnc', voipMessageId: messageId }
  }
  return { status: 'failed', reason: failureReason ?? 'send_error', voipMessageId: messageId }
}

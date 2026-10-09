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

/** Homeowner copy names the rep by nickname, else first name; null when the meeting has no rep. */
export function repDisplayName(rep: VisitMessageContext['rep']): string | null {
  if (!rep) {
    return null
  }
  return rep.nickname?.trim() || rep.name.trim().split(/\s+/)[0] || null
}

/**
 * Renders one visit text from the current wording and sends it from the main line. The caller records
 * the outcome: the summary inserts its row, a run finishes its claim.
 */
export async function deliverVisitText(ctx: ScopedContext, input: {
  context: VisitMessageContext
  templateKey: VisitMessageTemplateKey
  bodies: Record<VisitMessageTemplateKey, string>
  officeNote?: string | null
  mediaUrl?: string[]
}): Promise<VisitTextOutcome> {
  const { meeting, customer, rep } = input.context
  const remoteE164 = toE164(customer?.phone)
  if (!customer || !remoteE164) {
    return { status: 'skipped', reason: 'no_phone', voipMessageId: null }
  }

  const mainLine = await voipDidsService.getMainLineDid()
  if (!mainLine.success || !mainLine.data) {
    return { status: 'failed', reason: 'no_main_line', voipMessageId: null }
  }

  const stopLine = !(await hasOutboundOnThread({ voipDidId: mainLine.data.id, remoteE164 }))
  const body = renderVisitMessage(
    input.bodies[input.templateKey],
    buildVisitMessageVars({
      customerName: customer.name,
      repName: repDisplayName(rep),
      scheduledFor: meeting.scheduledFor,
      visitLink: visitLinkFor(meeting),
      officeNote: input.officeNote,
    }),
    { stopLine },
  )

  const sent = await voipMessagesService.sendFromMainLine(ctx, { customerId: customer.id, remoteE164, body, mediaUrl: input.mediaUrl })
  if (!sent.success) {
    console.error('[deliverVisitText] send refused', { meetingId: meeting.id, error: sent.error })
    return { status: 'failed', reason: 'send_error', voipMessageId: null }
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

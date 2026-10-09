import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'
import { setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { getMeetingMessageByProviderMessageId, getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { notificationService } from '@/shared/services/notification.service'

export const meetingMessageService = {
  ...meetingMessageCrud,

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
} as const

export type MeetingMessageService = typeof meetingMessageService

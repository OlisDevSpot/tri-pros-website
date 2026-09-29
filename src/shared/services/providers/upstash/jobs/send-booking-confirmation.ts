import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { nextSendWindowOpen } from '@/shared/services/voip/lib/sms-send-window'
import { meetingRemindersService } from '@/shared/services/voip/meeting-reminders.service'

import { createJob } from '../lib/create-job'

/**
 * "You're booked" text, dispatched best-effort from meetings.create.after. A booking made
 * at 10 pm re-enqueues itself for 8 am instead of texting inside quiet hours: QStash's
 * `notBefore` is the clock, so no row or timer lives in our process.
 */
export const sendBookingConfirmationJob = createJob(
  'send-booking-confirmation',
  async (payload: { meetingId: string }) => {
    const now = new Date()
    const opensAt = nextSendWindowOpen(now)
    if (opensAt > now) {
      await sendBookingConfirmationJob.dispatchOrThrow(payload, { notBefore: Math.ceil(opensAt.getTime() / 1000) })
      return
    }
    const result = dalVerifySuccess(await meetingRemindersService.sendBookingConfirmation(payload))
    if (result.skipped) {
      console.warn('[send-booking-confirmation] skipped', { meetingId: payload.meetingId, reason: result.skipped })
    }
  },
)

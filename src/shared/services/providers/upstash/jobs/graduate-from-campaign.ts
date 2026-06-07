import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Graduation handoff (EPIC decision #12 + #18). Fired when a meeting is booked
 * app-side — a booked meeting means CloudTalk's job is done, so we stop dialing
 * by unenrolling with reason `graduated`. The SAME idempotent op also fires from
 * the CT `meeting_booked` disposition webhook; whichever lands first wins, the
 * second is a no-op (no active enrollment → no-op).
 *
 * Dispatched `dispatchOrThrow` from the meeting create hook — stopping a dial is
 * NOT cosmetic; a dropped enqueue would leave a booked customer still being
 * auto-dialed. Handler is idempotent → safe under QStash retry.
 */
export const graduateFromCampaignJob = createJob(
  'graduate-from-campaign',
  async (payload: { customerId: string }) => {
    const result = await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
      customerId: payload.customerId,
      reason: 'graduated',
    })
    if (!result.success) {
      // Throw so QStash retries — the contact may still carry the membership tag.
      const reason = result.error.type === 'precondition-failed'
        ? result.error.reason
        : result.error.type
      throw new Error(`graduate-from-campaign failed for ${payload.customerId}: ${reason}`)
    }
  },
)

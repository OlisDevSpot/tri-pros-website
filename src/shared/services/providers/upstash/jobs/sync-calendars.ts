import { getAccountsWithGCalEnabled } from '@/shared/entities/accounts/dal/server/google-calendar'
import { schedulingService } from '@/shared/services/scheduling.service'
import { createJob } from '../lib/create-job'

/**
 * Periodic refresh for every account that has a Google Calendar linked:
 *  1. Pull inbound changes from GCal (catches events created/edited in
 *     the GCal UI for any per-user activity calendar, AND on the system
 *     owner's centralized meetings calendar).
 *  2. Renew the webhook channel if it's within 24h of expiry. Google
 *     channels cap at 7 days — without this renewal, inbound webhooks
 *     stop firing and the app drifts out of sync silently.
 *
 * **Scheduling required** — this job has no automatic trigger today. It
 * must be scheduled externally:
 *   - QStash dashboard → recurring message to
 *     `${BASE_URL}/api/qstash-jobs?job=sync-calendars` (recommended; the
 *     existing route handler already verifies QStash signatures), OR
 *   - Vercel Cron → `vercel.json` `crons` entry hitting a new cron-only
 *     endpoint with `CRON_SECRET` auth (requires new env var + route).
 *
 * Recommended cadence: every 12-24h. The renewal-eligibility window is
 * 24h before expiry, so any cadence ≤24h keeps channels evergreen.
 *
 * Until scheduled, super-admins can manually trigger renewal for the
 * system owner via `scheduleRouter.sync.renewSystemOwnerChannel`, and
 * observe channel health via `scheduleRouter.sync.systemOwnerHealth`.
 */
export const syncCalendarsJob = createJob(
  'sync-calendars',
  async (_payload: Record<string, never>) => {
    const accounts = await getAccountsWithGCalEnabled()

    for (const acct of accounts) {
      await schedulingService.handleInboundSync(acct.userId).catch((err) => {
        console.error(`[sync-calendars] handleInboundSync failed for ${acct.userId}:`, err)
      })

      await schedulingService.renewChannelIfNeeded(acct.userId).catch((err) => {
        console.error(`[sync-calendars] renewChannelIfNeeded failed for ${acct.userId}:`, err)
      })
    }
  },
)

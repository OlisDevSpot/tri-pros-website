import { schedulingService } from '@/shared/services/scheduling.service'

import { createJob } from '../lib/create-job'

/**
 * Re-sync every meeting of a single customer that already has a GCal
 * event, so customer-derived fields embedded in the event payload (name,
 * phone, email, address) reflect the latest DB row. Fired from
 * `customerServerSpec.hooks.update.after` on every customer update —
 * `propagateCustomerChange` short-circuits internally if the customer
 * has no synced meetings, so unrelated customer edits are cheap.
 *
 * Handler is idempotent: each per-meeting push re-uses GCal etags for
 * optimistic concurrency. Safe under QStash retry.
 */
export const propagateCustomerChangeJob = createJob(
  'propagate-customer-change',
  async (payload: { customerId: string }) => {
    await schedulingService.propagateCustomerChange(payload.customerId)
  },
)

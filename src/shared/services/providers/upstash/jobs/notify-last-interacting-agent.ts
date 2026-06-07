import { resolveCustomerByPhone } from '@/shared/services/voip/campaigns/lib/resolve-customer'

import { createJob } from '../lib/create-job'

/**
 * Cosmetic courtesy notification (EPIC W3): an inbound NON-STOP SMS arrived on a
 * CloudTalk campaign number. We do NOT persist the SMS (CT keeps the record —
 * INTEGRATION-SEAM §8); ring-1 just surfaces it. Dispatched best-effort
 * (`void job.dispatch`) from the webhook — silent loss is acceptable, so this is
 * a QStash job, NOT `after()`.
 *
 * @migration: ring-2 resolves the last-interacting agent for the customer and
 * pushes a real notification (web-push / in-app). Ring-1 resolves the customer
 * and logs — the wiring (job + dispatch path) is in place so adding the push is
 * a one-method change.
 */
export const notifyLastInteractingAgentJob = createJob(
  'notify-last-interacting-agent',
  async (payload: { customerPhoneE164: string, body: string }) => {
    const customer = await resolveCustomerByPhone(payload.customerPhoneE164)
    console.warn('[notify-last-interacting-agent] inbound campaign SMS', {
      customerId: customer?.id ?? null,
      fromE164: payload.customerPhoneE164,
      preview: payload.body.slice(0, 80),
    })
  },
)

// Customer-resolution helpers for the dialer webhook (EPIC kickoff step 3).
// Thin read-composers over entity DAL queries — they unwrap DalReturn and
// collapse not-found / db-error to `null` so the webhook handler can branch
// with a simple `if (customer)`. The handler stays 200-on-error per the
// webhook-routes convention; a null here just means "no app-side action."

import { findCustomerByPhone } from '@/shared/entities/customers/dal/server/queries'
import { findCustomerIdByProviderContactId } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

export interface ResolvedCustomer {
  id: string
}

/** Resolve a customer by inbound SMS sender phone (E.164). */
export async function resolveCustomerByPhone(phoneE164: string): Promise<ResolvedCustomer | null> {
  const result = await findCustomerByPhone(phoneE164)
  if (!result.success || !result.data) {
    return null
  }
  return { id: result.data.id }
}

/**
 * Resolve a customer by the dialer provider contact id carried on a disposition
 * event — via the `voip_campaign_contacts.provider_contact_id` bridge. Returns
 * null for unknown / non-enrolled provider contacts.
 */
export async function resolveCustomerByProviderContactId(
  providerContactId: string,
): Promise<ResolvedCustomer | null> {
  if (!providerContactId) {
    return null
  }
  const result = await findCustomerIdByProviderContactId(providerContactId)
  if (!result.success || !result.data) {
    return null
  }
  return { id: result.data.customerId }
}

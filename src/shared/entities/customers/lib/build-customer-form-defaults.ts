import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { CustomerFormValues } from '@/shared/entities/customers/types'

import { PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'

/**
 * Seeds the edit-form defaults straight off the composed customer+profile row
 * (Addendum B — profile-trio columns live on the `customer_profiles` child
 * table; `age` stays on `customers`) — no more JSONB blob spreads.
 */
export function buildCustomerFormDefaults(customer: CustomerWithProfile): CustomerFormValues {
  const profileDefaults = Object.fromEntries(
    PROFILE_COLUMN_KEYS.map(key => [key, customer[key] ?? undefined]),
  ) as Partial<Pick<CustomerWithProfile, (typeof PROFILE_COLUMN_KEYS)[number]>>

  return {
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    zip: customer.zip ?? '',
    age: customer.age ?? undefined,
    ...profileDefaults,
  }
}

import type { Customer } from '@/shared/db/schema'
import type { CustomerFormValues } from '@/shared/entities/customers/types'

import { PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'

/**
 * Seeds the edit-form defaults straight off the customer row's profile-trio
 * columns (epic #256/#259) — no more JSONB blob spreads.
 */
export function buildCustomerFormDefaults(customer: Customer): CustomerFormValues {
  const profileDefaults = Object.fromEntries(
    PROFILE_COLUMN_KEYS.map(key => [key, customer[key] ?? undefined]),
  ) as Partial<Pick<Customer, (typeof PROFILE_COLUMN_KEYS)[number]>>

  return {
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    zip: customer.zip ?? '',
    ...profileDefaults,
  }
}

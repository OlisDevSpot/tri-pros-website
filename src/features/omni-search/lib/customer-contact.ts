import type { OmniCustomer } from '@/features/omni-search/types'

import { formatCustomerAddress } from '@/shared/lib/formatters'

/** The capsule's contact fields. A city alone is not a useful Maps target, so the address needs a street. */
export function customerContact(customer: OmniCustomer): { phone: string | null, email: string | null, address: string | null } {
  const address = customer.address
    ? formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip }).singleLine
    : null
  return { phone: customer.phone, email: customer.email, address }
}

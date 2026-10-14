import type { MatchMode } from '@/features/omni-search/lib/split-match'
import type { OmniCustomer } from '@/features/omni-search/types'

import { formatPhone } from '@/shared/lib/phone'

/** What the customer matched on; a name match shows where they live instead (the street, else the zip). */
export function customerExcerpt(customer: OmniCustomer): { text: string, mode: MatchMode } | null {
  switch (customer.matchedOn) {
    case 'phone': return customer.phone ? { text: formatPhone(customer.phone), mode: 'digits' } : null
    case 'email': return customer.email ? { text: customer.email, mode: 'text' } : null
    case 'address':
    case 'name': {
      const text = customer.address ?? customer.zip
      return text ? { text, mode: 'text' } : null
    }
  }
}

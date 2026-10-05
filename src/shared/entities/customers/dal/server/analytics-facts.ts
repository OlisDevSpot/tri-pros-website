import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'

export interface CustomerFact {
  id: string
  phone: string | null
  email: string | null
  createdAt: string
  leadSourceId: string | null
  city: string
  zip: string
}

// System-level read: every customer, unscoped — analytics callers are super-admin gated at the router.
export async function listCustomerFacts(): Promise<DalReturn<CustomerFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: customers.id,
        phone: customers.phone,
        email: customers.email,
        createdAt: customers.createdAt,
        leadSourceId: customers.leadSourceId,
        city: customers.city,
        zip: customers.zip,
      })
      .from(customers)
    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }))
  })
}

import type { EntityServerSpec } from '@/shared/dal/server/types'

import { eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import {
  customers,
  insertCustomerSchema,
  meetings,
  proposals,
  selectCustomerSchema,
} from '@/shared/db/schema'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

const updateCustomerSchema = insertCustomerSchema.partial()

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

export const customerServerSpec = {
  entityName: CUSTOMER,
  caslSubject: CUSTOMER,
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
  // see ../DOCS.md#three-jsonb-profiles + ../DOCS.md#lead-attribution-fields —
  // agents fill these progressively; partial updates must deep-merge, not overwrite.
  // Wired by createCrudDal.updateImpl (since 7bc34a7).
  update: {
    jsonbMergeColumns: [
      customers.customerProfileJSON,
      customers.propertyProfileJSON,
      customers.financialProfileJSON,
      customers.leadMetaJSON,
    ] as const,
  },
  hooks: {
    delete: {
      // The schema's FK behavior for meetings.customerId and proposals.meetingId
      // is `set null` on parent delete — without this hook, deleting a customer
      // would orphan rows that surface in lists with no owner. Manually delete
      // proposals → meetings in the same logical step before the customer row
      // is removed. customer_notes and projects cascade via schema FKs.
      // The cascade tx commits before the parent customer delete runs. If the
      // parent delete fails after the cascade succeeds, the customer row survives
      // with children gone — recoverable by retry (the no-children re-run is a
      // clean no-op).
      // Was previously inlined in dal/server/queries.ts:deleteCustomer.
      async before(id, _ctx) {
        const customerId = String(id)
        await db.transaction(async (tx) => {
          const customerMeetings = await tx
            .select({ id: meetings.id })
            .from(meetings)
            .where(eq(meetings.customerId, customerId))
          const meetingIds = customerMeetings.map(m => m.id)
          if (meetingIds.length > 0) {
            await tx.delete(proposals).where(inArray(proposals.meetingId, meetingIds))
            await tx.delete(meetings).where(inArray(meetings.id, meetingIds))
          }
        })
      },
    },
  },
} satisfies EntityServerSpec<typeof customers>

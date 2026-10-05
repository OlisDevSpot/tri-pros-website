import { z } from 'zod'

import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  customers,
  insertCustomerSchema,
  selectCustomerSchema,
} from '@/shared/db/schema'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

// Updates allow `createdAt` (super-admin-only via CASL field gate) — legacy
// Notion imports land with import-day timestamps and lead-source stats by
// range stay misleading until the super-admin corrects them. The base insert
// schema omits `createdAt`, so re-add it here for the update surface.
const updateCustomerSchema = insertCustomerSchema
  .partial()
  .extend({ createdAt: z.string().datetime().optional() })

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

// duplicate (default createCrudDal impl) copies only `customers` columns — it
// does NOT copy the customer's `customer_profiles` child row.
//
// Lifecycle hooks (address-change geocode invalidation, customer-change
// propagation, delete cascade) live in the config factory in
// ../dal/server/crud.ts — NOT on this spec.
export const customerServerSpec = defineEntitySpec({
  entityName: CUSTOMER,
  subject: CUSTOMER,
  conditionColumns: [],
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
})

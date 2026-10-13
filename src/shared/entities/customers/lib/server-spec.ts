import { z } from 'zod'

import { defineEntitySpec, defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  customers,
  insertCustomerSchema,
  selectCustomerSchema,
} from '@/shared/db/schema'
import {
  customerLeadAttribution,
  insertCustomerLeadAttributionSchema,
  leadAttributionCaptureSchema,
  selectCustomerLeadAttributionSchema,
} from '@/shared/db/schema/customer-lead-attribution'
import {
  customerProfilePatchSchema,
  customerProfiles,
  insertCustomerProfileSchema,
  selectCustomerProfileSchema,
} from '@/shared/db/schema/customer-profiles'
import { CUSTOMER, CUSTOMER_LEAD_ATTRIBUTION, CUSTOMER_PROFILE } from '@/shared/entities/customers/lib/constants'

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
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
})

// The discovery profile is a part of the customer: a rule names it as the field `profile`, and a
// write needs the customer's `update` on `profile` and on each `profile.<column>`.
export const customerProfileServerSpec = defineSubEntitySpec({
  entityName: CUSTOMER_PROFILE,
  table: customerProfiles,
  schemas: {
    insert: insertCustomerProfileSchema,
    update: customerProfilePatchSchema,
    select: selectCustomerProfileSchema,
  },
  primaryKey: 'customerId',
  parent: { spec: customerServerSpec, fk: customerProfiles.customerId, field: 'profile' },
})

// Written once at capture by the system; read with the customer.
export const customerLeadAttributionServerSpec = defineSubEntitySpec({
  entityName: CUSTOMER_LEAD_ATTRIBUTION,
  table: customerLeadAttribution,
  schemas: {
    insert: insertCustomerLeadAttributionSchema,
    update: leadAttributionCaptureSchema,
    select: selectCustomerLeadAttributionSchema,
  },
  primaryKey: 'customerId',
  parent: { spec: customerServerSpec, fk: customerLeadAttribution.customerId, field: 'leadAttribution' },
})

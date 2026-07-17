import type { CustomerProfile, FinancialProfile, LeadMeta, PropertyProfile } from '@/shared/entities/customers/schemas'
import { doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import { customerPipelines, leadTypes } from '@/shared/constants/enums'
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'
import { optionalPhoneSchema } from '@/shared/lib/phone'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { leadSourcesTable } from './lead-sources'

export const customers = pgTable('customers', {
  id,
  qbCustomerId: text('qb_customer_id'),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city').notNull(),
  state: varchar('state', { length: 2 }).default('CA'),
  zip: text('zip').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  geocodedAt: timestamp('geocoded_at', { mode: 'string', withTimezone: true }),
  /**
   * @deprecated Wave-1 frozen (epic #256/#259). Zero writers. Read only by
   * scripts/backfill-wave1-columns.ts. Dropped next release.
   */
  customerProfileJSONDeprecated: jsonb('customer_profile_json').$type<CustomerProfile>(),
  /**
   * @deprecated Wave-1 frozen (epic #256/#259). Zero writers. Read only by
   * scripts/backfill-wave1-columns.ts. Dropped next release.
   */
  propertyProfileJSONDeprecated: jsonb('property_profile_json').$type<PropertyProfile>(),
  /**
   * @deprecated Wave-1 frozen (epic #256/#259). Zero writers. Read only by
   * scripts/backfill-wave1-columns.ts. Dropped next release.
   */
  financialProfileJSONDeprecated: jsonb('financial_profile_json').$type<FinancialProfile>(),
  // `age` deliberately stays a plain column here (Addendum B.2, 2026-07-14) —
  // identity-adjacent, written by anonymous homeowners via the contracts
  // share-token flow, read by legal envelope rules. The other 23 former
  // customerProfileJSON/propertyProfileJSON/financialProfileJSON fields now
  // live on the `customer_profiles` 1:1 child table (PK-as-FK) — see
  // ../schema/customer-profiles.ts.
  age: integer('age'),
  leadSourceId: uuid('lead_source_id').references(() => leadSourcesTable.id, { onDelete: 'set null' }),
  leadType: text('lead_type', { enum: leadTypes }),
  /**
   * @deprecated Wave-2 frozen (epic #256). Zero writers. Read only by
   * scripts/backfill-wave2-children.ts. Replaced by customer_lead_attribution
   * (1:1 child) + customer_enrichment rows. Dropped next release.
   */
  leadMetaJSONDeprecated: jsonb('lead_meta_json').$type<LeadMeta>(),
  // Coarse 3-bucket customer-level pipeline. UI uses a 5-bucket derived
  // classification that explodes `active` based on downstream records.
  // see src/shared/entities/customers/DOCS.md#derived-5-bucket-pipeline
  pipeline: text('pipeline', { enum: customerPipelines }).notNull().default('active'),
  // Lead-funnel stage for customers in the `leads` derived pipeline (no meetings yet).
  // see src/shared/entities/customers/DOCS.md#pipeline-stage-only-for-leads
  pipelineStage: text('pipeline_stage'),
  // DNC (Do-Not-Call) — shared canonical registry decorating the customer row.
  // Both voip-in-house (Twilio) and voip-campaigns (CloudTalk) INSERT into it
  // and gate outbound against it. Owning service: src/shared/services/voip/compliance.service.ts.
  // see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS (2026-05-30)
  // see docs/plans/voip/INTEGRATION-SEAM.md §5 (DNC propagation)
  dncOptedOutAt: timestamp('dnc_opted_out_at', { mode: 'string', withTimezone: true }),
  // Free-text reason tag: 'customer_request' | 'ftc' | 'admin' | 'stop_keyword' | etc.
  // Reason-tagged, not origin-tagged — the registry has no concept of which provider received the STOP.
  dncReason: text('dnc_reason'),
  // FK to user.id which is `text` (better-auth string IDs), not uuid.
  dncAddedByUserId: text('dnc_added_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  // NOTE: voip-campaigns adds NO fields here. All per-customer CloudTalk state
  // (enrollment membership, dial attempts, CT identity, sync) lives in
  // `voip_campaign_contacts` (1:1, customer_id PK). The DNC fields above are the
  // exception — they are SHARED compliance, written by both EPICs.
  // see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04
  syncedAt: timestamp('synced_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  createdAt,
  updatedAt,
})

// No overrides for the three *Deprecated blobs — uniform with how
// customerProfileJSON already worked pre-Wave-1 (drizzle-zod infers from the
// column's `.$type<>()`). Frozen; select-side typing precision doesn't matter.
export const selectCustomerSchema = createSelectSchema(customers)
export type Customer = z.infer<typeof selectCustomerSchema>

export const insertCustomerSchema = createInsertSchema(customers, {
  // Canonical storage chokepoint: every write through createCrudDal parses this
  // schema, so phone is normalized to bare 10-digit national (or null) here —
  // regardless of caller (funnel E.164, agent-typed "(818)…", webhook raw).
  // see @/shared/lib/phone
  phone: optionalPhoneSchema,
  // Explicit `null` clears the field, distinct from `undefined` (field
  // untouched, omitted from the patch entirely) — same convention the
  // customer_profiles child table's patch schema uses.
  age: z.number().int().min(CUSTOMER_AGE_MIN).max(CUSTOMER_AGE_MAX).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // Wave-1 frozen — no caller may write the deprecated blobs anymore.
  customerProfileJSONDeprecated: true,
  propertyProfileJSONDeprecated: true,
  financialProfileJSONDeprecated: true,
  // Wave-2 frozen — leadMeta now lives in customer_lead_attribution + customer_enrichment.
  leadMetaJSONDeprecated: true,
})
export type InsertCustomerSchema = z.infer<typeof insertCustomerSchema>

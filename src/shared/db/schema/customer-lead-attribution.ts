import type z from 'zod'
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadMetaSchema, leadSourceKinds } from '@/shared/entities/customers/schemas'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'

// 1:1 lead-attribution child (PK-as-FK, Addendum B). Row-exists = attribution
// was captured at intake. Written ONCE at capture (intake service / backfill);
// immutable afterward — the hot-field columns are the ads-reporting query
// surface, capture_json is the raw immutable snapshot (typed LeadMeta) MINUS
// source.enrichment, which lives in customer_enrichment rows (the one mutable
// part). Promoted fields also remain inside capture_json by design: the
// snapshot never changes after capture, so the duplication cannot drift.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export const customerLeadAttribution = pgTable('customer_lead_attribution', {
  customerId: uuid('customer_id').primaryKey().references(() => customers.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: leadSourceKinds }).notNull(),
  funnelSlug: text('funnel_slug'),
  offer: text('offer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'),
  utmTerm: text('utm_term'),
  captureJSON: jsonb('capture_json').$type<LeadMeta>(),
  createdAt,
  updatedAt,
})

export const selectCustomerLeadAttributionSchema = createSelectSchema(customerLeadAttribution)
export type CustomerLeadAttributionRow = z.infer<typeof selectCustomerLeadAttributionSchema>

export const insertCustomerLeadAttributionSchema = createInsertSchema(customerLeadAttribution, {
  // drizzle-zod types $type<> jsonb loosely — pin the snapshot's internal
  // shape to the canonical capture schema (jsonb-columns.md#zod-parse-at-write-boundary).
  captureJSON: leadMetaSchema.nullable().optional(),
}).omit({ createdAt: true, updatedAt: true })
export type InsertCustomerLeadAttribution = z.infer<typeof insertCustomerLeadAttributionSchema>

// Wire shape for the capture-time write (customerId supplied by the DAL).
export const leadAttributionCaptureSchema = insertCustomerLeadAttributionSchema.omit({ customerId: true })

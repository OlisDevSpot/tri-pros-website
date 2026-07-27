import type { FunnelUtm } from '@/shared/domains/funnels/types'
import type z from 'zod'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

/** One step-advance observation on a draft lead. Append-only. */
export interface LeadStepTimelineEntry {
  stepId: string
  stepIndex: number
  enteredAt: string // ISO — written by JS, never SQL NOW()
}

// The lead phase of a funnel visitor, decoupled from customers (design spec
// 2026-07-26 §3). Created anonymously on FIRST ANSWER (not page load — filters
// bots/bounces); a referencing customers.leadId row means "converted", no row
// means "draft" — status is DERIVED, never stored. NO PII lives here: PII
// enters only through submitLead → customers. Drafts are retained
// indefinitely (prune job deliberately omitted — Oliver, 2026-07-27; revisit
// if the table ever gets heavy). Track 2 (customers→leads port) grows this
// table into the full lead entity — see the design spec §6.
export const leads = pgTable('leads', {
  id,
  funnelSlug: text('funnel_slug').notNull(),
  trade: text('trade'),
  // Answers-so-far keyed by step id. Full-value writes only — never a shallow
  // jsonb merge. see docs/codebase-conventions/jsonb-columns.md
  answersJSON: jsonb('answers_json').$type<Record<string, unknown>>().notNull(),
  stepTimelineJSON: jsonb('step_timeline_json').$type<LeadStepTimelineEntry[]>().notNull(),
  // Promoted attribution hot-fields (mirrors customer_lead_attribution's
  // promoted-columns pattern); utmJSON is the provider-plural raw capture
  // (source/medium/campaign/content/term + fbclid + gclid).
  fbclid: text('fbclid'),
  fbp: text('fbp'),
  utmJSON: jsonb('utm_json').$type<FunnelUtm>(),
  // Captured server-side at draft creation so the delayed CRM Schedule event
  // can carry the session's real IP/UA match keys (not persisted anywhere else).
  clientIp: text('client_ip'),
  clientUserAgent: text('client_user_agent'),
  // Meta join key: the Lead pixel/CAPI event_id, stamped at PII submit.
  metaLeadEventId: text('meta_lead_event_id'),
  createdAt,
  updatedAt,
}, table => [
  index('leads_funnel_slug_created_at_idx').on(table.funnelSlug, table.createdAt),
  index('leads_fbclid_idx').on(table.fbclid),
])

export const selectLeadSchema = createSelectSchema(leads)
export type Lead = z.infer<typeof selectLeadSchema>

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertLead = z.infer<typeof insertLeadSchema>

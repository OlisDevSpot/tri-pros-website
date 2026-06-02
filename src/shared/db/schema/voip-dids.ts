import type z from 'zod'
import { sql } from 'drizzle-orm'
import { boolean, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'

// voip_dids — Twilio (or future provider) DIDs assigned to Tri Pros humans.
// Cardinality is 1:N (a user can own multiple DIDs — e.g., info@ with several
// inbound reception lines). At most one DID per user is `is_primary=TRUE`,
// enforced by a partial unique index.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS — voip_dids
export const voipDids = pgTable('voip_dids', {
  id,
  e164: text('e164').notNull().unique(),
  // Provider-neutral opaque ID (Twilio Phone SID today).
  providerDidId: text('provider_did_id').notNull().unique(),
  // CNAM display name shown to recipients. Provider dashboard is source of truth; mirrored for queryability.
  cnamDisplayName: text('cnam_display_name'),
  // Freeform internal label — "424 marketing", "Oliver's line", "main reception". Not an enum.
  label: text('label'),
  // Sticky outbound owner. NULL = shared / inbound-only (e.g., main reception fanned out by provider call flow).
  assignedUserId: text('assigned_user_id').references(() => user.id, { onDelete: 'set null' }),
  // User's primary outbound DID. At most one TRUE per assignedUserId (partial unique index below).
  // App logic auto-sets TRUE for the first DID assigned to a user; subsequent default FALSE.
  isPrimary: boolean('is_primary').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
}, table => ({
  uniqPrimaryPerUser: uniqueIndex('voip_dids_assigned_user_primary_uniq')
    .on(table.assignedUserId)
    .where(sql`${table.isPrimary} = TRUE`),
}))

export const selectVoipDidSchema = createSelectSchema(voipDids)
export type VoipDid = z.infer<typeof selectVoipDidSchema>

export const insertVoipDidSchema = createInsertSchema(voipDids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipDidSchema = z.infer<typeof insertVoipDidSchema>

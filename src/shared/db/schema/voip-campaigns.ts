import type z from 'zod'
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { dialerModes, voipCampaignStatuses } from '@/shared/constants/enums/voip'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

// Dialer identity bridge — mirrors per-source dialer-provider (JustCall) Campaign
// IDs + dialer mode + status from the provider dashboard into our DB. Synced via
// the admin-triggered `resyncDialer` mutation. JustCall has NO membership tags:
// enrollment is an explicit `dialerProvider.enroll(campaignId, ...)` call, so the
// former `ct_membership_tag` / `ct_tag_id` columns are gone.
//
// Provider-assigned IDs are runtime data, not source-code constants — they are
// NOT env vars. APP-side policy (voipCampaignsEnabled / voipAutoEnroll /
// dailyDialVolumeCap) lives on plain `lead_sources` columns, while dialer
// identity lives here. Campaign-to-lead-source join is via
// `lead_sources.default_campaign_id` (a real FK to this table's `id`).
//
// see docs/plans/voip-campaigns/EPIC.md
// see docs/plans/voip/INTEGRATION-SEAM.md
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md

export const voipCampaigns = pgTable(
  'voip_campaigns',
  {
    id,
    // Provider-assigned campaign ID (mirrored from the dialer's campaign list).
    // The stable natural key — sync upserts on this.
    providerCampaignId: text('provider_campaign_id').notNull().unique(),
    providerCampaignName: text('provider_campaign_name').notNull(),
    // 'active' | 'inactive' — mirrored from the provider campaign status.
    status: text('status', { enum: voipCampaignStatuses }).notNull(),
    // Per-campaign dialer mode ('autodial' | 'dynamic' | 'predictive') — mirrored
    // from the provider campaign `type`. Bina's source runs 'dynamic'.
    dialerMode: text('dialer_mode', { enum: dialerModes }).notNull().default('autodial'),
    // Cadence — mirrored from provider campaign config. Phase 1 lock: 10 × 3hr.
    // App-side exhaustion detection counts `call.ended` events to this cap.
    attemptsPerContact: integer('attempts_per_contact').notNull().default(10),
    hoursBetweenAttempts: integer('hours_between_attempts').notNull().default(3),
    // App-authored SMS cadence config (NOT provider-mirrored). Resync-safe:
    // upsertCampaignByProviderId never writes this column. Shape = smsCadenceSchema.
    smsCadence: jsonb('sms_cadence').$type<SmsCadence>(),
    // Updated on each successful admin Resync.
    lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt,
    updatedAt,
  },
)

export const selectVoipCampaignSchema = createSelectSchema(voipCampaigns)
export type VoipCampaign = z.infer<typeof selectVoipCampaignSchema>

export const insertVoipCampaignSchema = createInsertSchema(voipCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipCampaign = z.infer<typeof insertVoipCampaignSchema>

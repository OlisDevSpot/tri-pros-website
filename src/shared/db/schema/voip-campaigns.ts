import type z from 'zod'
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

// CT identity bridge — mirrors per-source CloudTalk Campaign IDs + membership
// tag names + cadence config from the CT dashboard into our DB. Synced via the
// admin-triggered `resyncFromCloudtalk` mutation (Phase 1 W8); Phase 2 may add
// a daily cron if drift is observed in practice.
//
// CT-assigned IDs are runtime data, not source-code constants — they are NOT
// env vars. APP-side policy (enabled / autoEnroll / dailyDialVolumeCap) lives in
// `lead_sources.voipConfigJSON.campaigns`, while CT identity lives here.
// source_slug binding was removed — campaign-to-lead-source join is now via
// `lead_sources.voipConfigJSON.campaigns[].ctCampaignId` (see ADR-0002 decisions log).
//
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-31
// see docs/plans/voip-campaigns/phase-1-implementation.md#w2
// see docs/plans/voip/INTEGRATION-SEAM.md#9

export const voipCampaigns = pgTable(
  'voip_campaigns',
  {
    id,
    // CT-assigned campaign ID (mirrored from GET /campaigns/index.json). The stable
    // natural key — sync upserts on this.
    ctCampaignId: text('ct_campaign_id').notNull().unique(),
    ctCampaignName: text('ct_campaign_name').notNull(),
    // 'Campaign-MetaAds' | 'Campaign-HomeDepot' — addTags target for enrollment.
    // CT auto-includes any contact carrying this tag in the matching campaign.
    ctMembershipTag: text('ct_membership_tag').notNull().unique(),
    // Optional — CT exposes tag IDs separately via GET /tags/index.json. Not
    // load-bearing; addTags/removeTags reference by name.
    ctTagId: text('ct_tag_id'),
    // 'active' | 'inactive' — mirrored from CT campaign status. Holiday-pause
    // cron sets to 'inactive'; resume cron sets back to 'active'.
    ctStatus: text('ct_status').notNull(),
    // Cadence — mirrored from CT campaign config. Phase 1 lock: 10 × 3hr.
    // App-side exhaustion detection counts `call.ended` events to this cap.
    attemptsPerContact: integer('attempts_per_contact').notNull().default(10),
    hoursBetweenAttempts: integer('hours_between_attempts').notNull().default(3),
    // App-authored SMS cadence config (NOT CT-mirrored). Resync-safe:
    // upsertCampaignByCtId never writes this column. Shape = smsCadenceSchema.
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

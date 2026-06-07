import type z from 'zod'
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { voipCampaigns } from './voip-campaigns'

// Per-customer CloudTalk campaign-participation record. ONE row per customer who
// has ever been pushed to CloudTalk. This is the single home for ALL voip-campaigns
// per-customer state (renamed from `voip_contact_sync` 2026-06-04 to reflect the
// expanded role). `customers` carries NO voipCampaign* fields — only the shared
// DNC fields, which both EPICs write.
//
// State model (perfect separation — CloudTalk owns lifecycle; we own membership):
//   - Enrolled now      = row exists AND unenrolled_at IS NULL.
//   - Unenroll          = removeTags([membershipTag]) + set unenrolled_at +
//                         unenroll_reason ('graduated' | 'opted_out' | 'disqualified').
//                         The row and cloudtalk_contact_id PERSIST so re-enroll reuses
//                         the same CT contact (clear unenrolled_at + reason, set a new
//                         enrolled_at). Guarantees a customer is always unenrollable.
//                         Three exit paths, one idempotent op: graduation (meeting),
//                         opt-out (STOP), manual disqualification (bad lead). Each
//                         reachable from BOTH the UI and a CT webhook disposition.
//   - Which campaign     = RECORDED in `voip_campaign_id` (FK → voip_campaigns), NOT
//                         derived. A lead source owns MANY campaigns; a customer is
//                         enrolled in exactly ONE at a time. The membership tag to
//                         add/remove is read from that campaign row
//                         (voip_campaigns.ct_membership_tag). Re-enroll may point at a
//                         different campaign (update the FK).
//
// `attribute_hash` lets the per-source delta-pusher skip CT writes when nothing
// changed since last sync — saves rate-limit budget when customer rows churn for
// unrelated reasons.
//
// `dial_attempts` is moved off `customers` (2026-06-04). CloudTalk fires no
// "cadence exhausted" webhook, so ring-2 will count call.ended here and emit
// app-side cadence_exhausted at voip_campaigns.attempts_per_contact. Ring-1 ships
// the column unused; resets to 0 on re-enrollment.
//
// see docs/plans/voip-campaigns/phase-1-implementation.md#w2
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04

export const voipCampaignContacts = pgTable(
  'voip_campaign_contacts',
  {
    customerId: uuid('customer_id')
      .primaryKey()
      .references(() => customers.id, { onDelete: 'cascade' }),
    cloudtalkContactId: text('cloudtalk_contact_id').notNull().unique(),
    // The specific campaign this customer is currently/last enrolled in. A lead
    // source owns many campaigns; a customer is in exactly one at a time. Read this
    // to know which membership tag to add/remove. Nullable: null before first enroll.
    voipCampaignId: uuid('voip_campaign_id').references(() => voipCampaigns.id, { onDelete: 'set null' }),
    // Enrollment membership (we own this; CloudTalk owns lifecycle).
    enrolledAt: timestamp('enrolled_at', { mode: 'string', withTimezone: true }),
    unenrolledAt: timestamp('unenrolled_at', { mode: 'string', withTimezone: true }),
    // WHY we unenrolled — 'graduated' | 'opted_out' | 'disqualified' (typed via
    // voipUnenrollReasons). Set alongside unenrolled_at; null while enrolled.
    unenrollReason: text('unenroll_reason').$type<VoipUnenrollReason>(),
    // Dial-attempt counter (logic deferred to ring 2). Resets on re-enrollment.
    dialAttempts: integer('dial_attempts').notNull().default(0),
    attributeHash: text('attribute_hash').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSyncError: text('last_sync_error'),
    createdAt,
    updatedAt,
  },
  table => [
    index('voip_campaign_contacts_last_synced_at_idx').on(table.lastSyncedAt),
    index('voip_campaign_contacts_enrolled_at_idx').on(table.enrolledAt),
  ],
)

export const selectVoipCampaignContactSchema = createSelectSchema(voipCampaignContacts)
export type VoipCampaignContact = z.infer<typeof selectVoipCampaignContactSchema>

export const insertVoipCampaignContactSchema = createInsertSchema(voipCampaignContacts).omit({
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipCampaignContact = z.infer<typeof insertVoipCampaignContactSchema>

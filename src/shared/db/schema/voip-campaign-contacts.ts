import type z from 'zod'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { voipUnenrollReasons } from '@/shared/constants/enums/voip'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { voipCampaigns } from './voip-campaigns'

// One row per customer ever pushed to the dialer: the dialer owns call lifecycle, we own membership.
// Enrolled now = row exists AND unenrolled_at IS NULL. Unenroll never deletes — the row and
// provider_contact_id persist so re-enroll reuses the same provider contact (possibly in a different campaign).
// A customer is in exactly ONE campaign at a time. `customers` carries no voipCampaign* fields, only the shared DNC fields.
// `attribute_hash` lets the delta-pusher skip provider writes when nothing changed (rate-limit budget).
export const voipCampaignContacts = pgTable(
  'voip_campaign_contacts',
  {
    customerId: uuid('customer_id')
      .primaryKey()
      .references(() => customers.id, { onDelete: 'cascade' }),
    providerContactId: text('provider_contact_id').notNull().unique(),
    // null before first enroll.
    voipCampaignId: uuid('voip_campaign_id').references(() => voipCampaigns.id, { onDelete: 'set null' }),
    enrolledAt: timestamp('enrolled_at', { mode: 'string', withTimezone: true }),
    unenrolledAt: timestamp('unenrolled_at', { mode: 'string', withTimezone: true }),
    // Set alongside unenrolled_at; null while enrolled.
    unenrollReason: text('unenroll_reason', { enum: voipUnenrollReasons }),
    // All progress counters below reset on re-enrollment.
    // Counted app-side (the dialer fires no cadence-exhausted webhook); cadence_exhausted fires at attempts_per_contact.
    dialAttempts: integer('dial_attempts').notNull().default(0),
    // Most recent counted call.ended — the exactly-once dedup key. Null until the first counted call.
    lastCallUuid: text('last_call_uuid'),
    // Also the next message index (strict ladder).
    autoSmsSentCount: integer('auto_sms_sent_count').notNull().default(0),
    // Drives the ≤1/day gate.
    lastAutoSmsAt: timestamp('last_auto_sms_at', { mode: 'string', withTimezone: true }),
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

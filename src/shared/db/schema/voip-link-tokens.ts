import type z from 'zod'
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipLinkTokenTypeEnum } from './meta'

// voip_link_tokens — short-lived signed URLs for SMS-delivered actions.
// Phase 1 ships only `l_doc` (document review/signature link); the enum
// framework is in place so `l_pay` / `l_cal` / `l_esign` drop in later
// without a migration.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS — voip_link_tokens
export const voipLinkTokens = pgTable('voip_link_tokens', {
  id,
  // URL-safe random (~32 chars; base64url of 24 random bytes).
  token: text('token').notNull().unique(),
  type: voipLinkTokenTypeEnum('type').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // Captured at mint time. Immune to customer.phone updates.
  phoneE164: text('phone_e164').notNull(),
  // 48h hard expiry per EPIC. Cleanup cron purges expired+unused.
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
  // Set on first consume. Subsequent visits return "already used".
  usedAt: timestamp('used_at', { mode: 'string', withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  // Type-specific payload — for L-DOC: { slotId: uuid, instructions?: string }. Zod-validated at mint + consume.
  payloadJson: jsonb('payload_json').notNull(),
  createdAt,
  // NOTE: no updatedAt — tokens are immutable except for `usedAt` set once.
}, table => ({
  customerIdx: index('voip_link_tokens_customer_idx').on(table.customerId),
  expiresIdx: index('voip_link_tokens_expires_idx').on(table.expiresAt),
  phoneIdx: index('voip_link_tokens_phone_idx').on(table.phoneE164),
}))

export const selectVoipLinkTokenSchema = createSelectSchema(voipLinkTokens)
export type VoipLinkToken = z.infer<typeof selectVoipLinkTokenSchema>

export const insertVoipLinkTokenSchema = createInsertSchema(voipLinkTokens).omit({
  id: true,
  createdAt: true,
})
export type InsertVoipLinkTokenSchema = z.infer<typeof insertVoipLinkTokenSchema>

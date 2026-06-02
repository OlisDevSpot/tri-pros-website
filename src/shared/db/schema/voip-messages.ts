import type z from 'zod'
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipDirectionEnum, voipMessageStatusEnum } from './meta'
import { voipDids } from './voip-dids'

// voip_messages — Twilio SMS records. Threads are keyed by `(voipDidId, remoteE164)` —
// the same customer texting two Tri Pros DIDs = two separate threads. UI: when an
// agent opens a customer thread, they see messages on THEIR DID with that customer,
// not a flat merge across all DIDs.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS — voip_messages
export const voipMessages = pgTable('voip_messages', {
  id,
  // UNIQUE for webhook idempotency (status callbacks re-deliver).
  providerMessageId: text('provider_message_id').unique(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  voipDidId: uuid('voip_did_id').references(() => voipDids.id, { onDelete: 'set null' }),
  // Other party. Immune to customer.phone updates later.
  remoteE164: text('remote_e164').notNull(),
  body: text('body').notNull(),
  direction: voipDirectionEnum('direction').notNull(),
  status: voipMessageStatusEnum('status').notNull().default('queued'),
  // Set when status='failed' | 'undelivered'. Freeform: provider's error code + message.
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { mode: 'string', withTimezone: true }),
  failedAt: timestamp('failed_at', { mode: 'string', withTimezone: true }),
  agentUserId: text('agent_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => ({
  customerIdx: index('voip_messages_customer_idx').on(table.customerId),
  agentIdx: index('voip_messages_agent_idx').on(table.agentUserId),
  // Primary thread key. Per-thread queries AND per-DID list queries are
  // both covered via left-prefix.
  threadIdx: index('voip_messages_thread_idx').on(table.voipDidId, table.remoteE164),
  // Cross-DID admin queries ("all messages with Bob across all DIDs").
  remoteIdx: index('voip_messages_remote_idx').on(table.remoteE164),
}))

export const selectVoipMessageSchema = createSelectSchema(voipMessages)
export type VoipMessage = z.infer<typeof selectVoipMessageSchema>

export const insertVoipMessageSchema = createInsertSchema(voipMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipMessageSchema = z.infer<typeof insertVoipMessageSchema>

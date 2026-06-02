import type z from 'zod'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipCallStatusEnum, voipDirectionEnum } from './meta'
import { voipDids } from './voip-dids'

// voip_calls — Twilio call records (post-conversion comms between Tri Pros
// staff and already-known customers). Lead-conversion calls live in
// voip-campaigns tables, not here.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS — voip_calls
export const voipCalls = pgTable('voip_calls', {
  id,
  // UNIQUE for webhook idempotency (ON CONFLICT DO UPDATE for lifecycle patches).
  providerCallId: text('provider_call_id').unique(),
  // NULL = unknown inbound caller (no customer row exists for that number yet).
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // Which Tri Pros DID handled this call. NULL preserved if DID is later removed.
  voipDidId: uuid('voip_did_id').references(() => voipDids.id, { onDelete: 'set null' }),
  // Other party. Captured at call time; immune to customer.phone updates later.
  remoteE164: text('remote_e164').notNull(),
  direction: voipDirectionEnum('direction').notNull(),
  status: voipCallStatusEnum('status').notNull().default('queued'),
  // Set only if status='skipped_compliance'. Freeform: 'dnc' | 'outside_calling_hours' | 'kill_switch_active'.
  skipReason: text('skip_reason'),
  // Recording (populated post-call when recording enabled on the DID).
  recordingUrl: text('recording_url'),
  recordingDurationSeconds: integer('recording_duration_seconds'),
  initiatedAt: timestamp('initiated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp('answered_at', { mode: 'string', withTimezone: true }),
  endedAt: timestamp('ended_at', { mode: 'string', withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  // Who initiated (outbound) or picked up (inbound).
  agentUserId: uuid('agent_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => ({
  customerIdx: index('voip_calls_customer_idx').on(table.customerId),
  agentIdx: index('voip_calls_agent_idx').on(table.agentUserId),
  didIdx: index('voip_calls_did_idx').on(table.voipDidId),
  initiatedIdx: index('voip_calls_initiated_idx').on(table.initiatedAt),
}))

export const selectVoipCallSchema = createSelectSchema(voipCalls)
export type VoipCall = z.infer<typeof selectVoipCallSchema>

export const insertVoipCallSchema = createInsertSchema(voipCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipCallSchema = z.infer<typeof insertVoipCallSchema>

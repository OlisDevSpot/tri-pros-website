import type z from 'zod'
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { voipDids } from './voip-dids'

// One of our lines talking to one outside number. It owns its texts; archive and read are the team's own decisions.
export const voipConversations = pgTable('voip_conversations', {
  id,
  // Lines are deactivated, never deleted; a delete must not take history with it.
  voipDidId: uuid('voip_did_id').notNull().references(() => voipDids.id, { onDelete: 'restrict' }),
  remoteE164: text('remote_e164').notNull(),
  // The customer the number belongs to: set only when exactly one customer owns it.
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // A homeowner text after this time brings the conversation back; our own texts do not.
  archivedAt: timestamp('archived_at', { mode: 'string', withTimezone: true }),
  // Shared by the team: one person reading a conversation reads it for everyone.
  lastReadAt: timestamp('last_read_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => ({
  uniqLineRemote: uniqueIndex('voip_conversations_line_remote_uniq').on(table.voipDidId, table.remoteE164),
  customerIdx: index('voip_conversations_customer_idx').on(table.customerId),
}))

export const selectVoipConversationSchema = createSelectSchema(voipConversations)
export type VoipConversation = z.infer<typeof selectVoipConversationSchema>

export const insertVoipConversationSchema = createInsertSchema(voipConversations).pick({ voipDidId: true, remoteE164: true, customerId: true })

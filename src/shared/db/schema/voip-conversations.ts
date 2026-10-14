import type z from 'zod'
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { voipDids } from './voip-dids'

// What the team decided about one conversation: a line and a number. Everything about its texts is read from voip_messages.
export const voipConversations = pgTable('voip_conversations', {
  id,
  voipDidId: uuid('voip_did_id').notNull().references(() => voipDids.id, { onDelete: 'cascade' }),
  remoteE164: text('remote_e164').notNull(),
  // A homeowner text after this time brings the conversation back; our own texts do not.
  archivedAt: timestamp('archived_at', { mode: 'string', withTimezone: true }),
  // Shared by the team: one person reading a conversation reads it for everyone.
  lastReadAt: timestamp('last_read_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => ({
  uniqLineRemote: uniqueIndex('voip_conversations_line_remote_uniq').on(table.voipDidId, table.remoteE164),
}))

export const selectVoipConversationSchema = createSelectSchema(voipConversations)
export type VoipConversation = z.infer<typeof selectVoipConversationSchema>

export const insertVoipConversationSchema = createInsertSchema(voipConversations).pick({ voipDidId: true, remoteE164: true })

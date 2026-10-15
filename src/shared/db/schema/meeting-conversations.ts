import type z from 'zod'
import { relations } from 'drizzle-orm'
import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { meetings } from './meetings'
import { voipConversations } from './voip-conversations'

// A visit uses a conversation: one per recipient number per line. A customer's visits share a conversation; they never split it.
export const meetingConversations = pgTable('meeting_conversations', {
  id,
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => voipConversations.id, { onDelete: 'restrict' }),
  createdAt,
}, table => ({
  uniqMeetingConversation: uniqueIndex('meeting_conversations_meeting_conversation_uniq').on(table.meetingId, table.conversationId),
  conversationIdx: index('meeting_conversations_conversation_idx').on(table.conversationId),
}))

export const meetingConversationsRelations = relations(meetingConversations, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingConversations.meetingId], references: [meetings.id] }),
  conversation: one(voipConversations, { fields: [meetingConversations.conversationId], references: [voipConversations.id] }),
}))

export const selectMeetingConversationSchema = createSelectSchema(meetingConversations)
export type MeetingConversation = z.infer<typeof selectMeetingConversationSchema>

export const insertMeetingConversationSchema = createInsertSchema(meetingConversations).pick({ meetingId: true, conversationId: true })

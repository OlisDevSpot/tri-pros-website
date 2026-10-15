import type z from 'zod'
import { relations, sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { meetingMessageChannels, meetingMessageKinds, meetingMessageStatuses } from '@/shared/modules/meetings/conversations/constants/kinds'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { meetingConversations } from './meeting-conversations'
import { meetings } from './meetings'
import { voipMessages } from './voip-messages'

export const meetingMessages = pgTable('meeting_messages', {
  id,
  // The visit and the recipient this visit message was for.
  meetingConversationId: uuid('meeting_conversation_id').references(() => meetingConversations.id, { onDelete: 'cascade' }),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: meetingMessageKinds }).notNull(),
  channel: text('channel', { enum: meetingMessageChannels }),
  // The meeting time this message described. A moved meeting re-arms its automatic texts because lookups key on it.
  forScheduledFor: timestamp('for_scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
  status: text('status', { enum: meetingMessageStatuses }).notNull(),
  // Why a row is failed or skipped: twilio:<code>, send_error, dnc, no_phone, no_email, booked_after_noon, paused, manual.
  reason: text('reason'),
  voipMessageId: uuid('voip_message_id').references(() => voipMessages.id, { onDelete: 'restrict' }),
  emailProviderId: text('email_provider_id'),
  // Who sent a summary or skipped a step. Null means automatic.
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt,
  updatedAt,
}, table => ({
  meetingIdx: index('meeting_messages_meeting_idx').on(table.meetingId),
  // QStash delivers at least once, so this index is the only thing that stops a double send.
  // A manual skip is a row under it too, which is how a skip stops the run.
  uniqAutomatic: uniqueIndex('meeting_messages_automatic_uniq')
    .on(table.meetingId, table.kind, table.channel, table.forScheduledFor)
    .where(sql`${table.kind} IN ('day_before_reminder', 'rep_confirmation', 'visit_cancellation')`),
  // The double-send guard, per recipient. QStash delivers at least once; a manual skip is a row under it too.
  uniqSend: uniqueIndex('meeting_messages_send_uniq')
    .on(table.meetingConversationId, table.kind, table.forScheduledFor)
    .where(sql`${table.kind} IN ('day_before_reminder', 'rep_confirmation')`),
}))

export const meetingMessagesRelations = relations(meetingMessages, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingMessages.meetingId],
    references: [meetings.id],
  }),
  meetingConversation: one(meetingConversations, { fields: [meetingMessages.meetingConversationId], references: [meetingConversations.id] }),
}))

export const selectMeetingMessageSchema = createSelectSchema(meetingMessages)
export type MeetingMessage = z.infer<typeof selectMeetingMessageSchema>

export const insertMeetingMessageSchema = createInsertSchema(meetingMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingMessage = z.infer<typeof insertMeetingMessageSchema>

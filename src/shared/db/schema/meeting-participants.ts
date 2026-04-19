import type z from 'zod'

import { relations, sql } from 'drizzle-orm'
import { pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { meetings } from './meetings'
import { meetingParticipantRoleEnum } from './meta'

export const meetingParticipants = pgTable('meeting_participants', {
  id,
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: meetingParticipantRoleEnum().notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('meeting_id_user_id_unique').on(table.meetingId, table.userId),
  // Partial unique indexes: at most one owner row and one co_owner row per
  // meeting. Enforced atomically at the DB level — closes the TOCTOU window
  // in the application's check-then-insert pattern. Helpers are unconstrained.
  uniqueIndex('meeting_one_owner_idx')
    .on(table.meetingId)
    .where(sql`role = 'owner'`),
  uniqueIndex('meeting_one_co_owner_idx')
    .on(table.meetingId)
    .where(sql`role = 'co_owner'`),
])

export const meetingParticipantRelations = relations(meetingParticipants, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingParticipants.meetingId],
    references: [meetings.id],
  }),
  user: one(user, {
    fields: [meetingParticipants.userId],
    references: [user.id],
  }),
}))

export const selectMeetingParticipantSchema = createSelectSchema(meetingParticipants)
export type MeetingParticipant = z.infer<typeof selectMeetingParticipantSchema>

export const insertMeetingParticipantSchema = createInsertSchema(meetingParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingParticipant = z.infer<typeof insertMeetingParticipantSchema>

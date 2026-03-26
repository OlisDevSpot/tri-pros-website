import type z from 'zod'
import type {
  MeetingContext,
  MeetingFlowState,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  meetingContextSchema,
  meetingFlowStateSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { meetingOutcomeEnum, meetingTypeEnum } from './meta'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  meetingType: meetingTypeEnum('meeting_type').notNull().default('Fresh'),
  meetingOutcome: meetingOutcomeEnum('meeting_outcome').notNull().default('not_set'),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  contextJSON: jsonb('context_json').$type<MeetingContext>(),
  flowStateJSON: jsonb('flow_state_json').$type<MeetingFlowState>(),
  agentNotes: text('agent_notes'),
  createdAt,
  updatedAt,
})

export const meetingsRelations = relations(meetings, ({ one }) => ({
  owner: one(user, {
    fields: [meetings.ownerId],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [meetings.customerId],
    references: [customers.id],
  }),
}))

export const selectMeetingSchema = createSelectSchema(meetings, {
  contextJSON: meetingContextSchema.nullable(),
  flowStateJSON: meetingFlowStateSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  contextJSON: meetingContextSchema.optional(),
  flowStateJSON: meetingFlowStateSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>

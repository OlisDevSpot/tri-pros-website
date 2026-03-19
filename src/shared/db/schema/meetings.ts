import type z from 'zod'
import type {
  ProgramData,
  SituationProfile,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  programDataSchema,
  situationProfileSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { meetingStatusEnum } from './meta'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  contactName: text('contact_name'),
  program: text('program'),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
  status: meetingStatusEnum('status').notNull().default('in_progress'),
  situationProfileJSON: jsonb('situation_objective_profile_json').$type<SituationProfile>(),
  programDataJSON: jsonb('program_data_json').$type<ProgramData>(),
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
  situationProfileJSON: situationProfileSchema.nullable(),
  programDataJSON: programDataSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  situationProfileJSON: situationProfileSchema.optional(),
  programDataJSON: programDataSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  customerId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>

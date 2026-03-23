import type z from 'zod'
import type {
  MeetingScopes,
  ProgramData,
  SituationProfile,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  meetingScopesSchema,
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
  type: text('type'),
  program: text('program'),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  status: meetingStatusEnum('status').notNull().default('in_progress'),
  situationProfileJSON: jsonb('situation_objective_profile_json').$type<SituationProfile>(),
  programDataJSON: jsonb('program_data_json').$type<ProgramData>(),
  meetingScopesJSON: jsonb('meeting_scopes_json').$type<MeetingScopes>(),
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
  meetingScopesJSON: meetingScopesSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  situationProfileJSON: situationProfileSchema.optional(),
  programDataJSON: programDataSchema.optional(),
  meetingScopesJSON: meetingScopesSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>

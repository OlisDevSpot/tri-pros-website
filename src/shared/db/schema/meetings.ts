import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type {
  MeetingContext,
  MeetingFlowState,
} from '@/shared/entities/meetings/schemas'

import { relations, sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'

import { homeownerConfirmationOptions, meetingOutcomes, meetingPipelines, meetingTypes } from '@/shared/constants/enums'
import {
  meetingContextSchema,
  meetingFlowStateSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { projects } from './projects'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Who booked the meeting, often a dispatcher. Not ownerId: a dispatcher's booking goes to the system owner.
  setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  meetingType: text('meeting_type', { enum: meetingTypes }).notNull().default('Fresh'),
  meetingOutcome: text('meeting_outcome', { enum: meetingOutcomes }).notNull().default('not_set'),
  pipeline: text('pipeline', { enum: meetingPipelines }).notNull().default('fresh'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
  // When scheduledFor was last set. A run that had already gone when the time was set never picks the meeting up.
  scheduledForSetAt: timestamp('scheduled_for_set_at', { mode: 'string', withTimezone: true }).notNull().defaultNow(),
  // Soft, day-of: the homeowner said they'll be home. Cleared whenever scheduledFor moves.
  confirmedAt: timestamp('confirmed_at', { mode: 'string', withTimezone: true }),
  // The homeowner's own "I'll be there" for this time. Never moves the pipeline; the office still sets confirmedAt.
  homeownerConfirmedAt: timestamp('homeowner_confirmed_at', { mode: 'string', withTimezone: true }),
  homeownerConfirmedVia: text('homeowner_confirmed_via', { enum: homeownerConfirmationOptions }),
  // When the homeowner asked for a new time. Kept after the time moves: it records what they did.
  newTimeRequestedAt: timestamp('new_time_requested_at', { mode: 'string', withTimezone: true }),
  // Belongs to the visit, not the row: a reschedule hands it to the replacement.
  // The database default exists only so adding the column fills existing rows; create.before supplies generateToken().
  shareToken: text('share_token').notNull().default(sql`replace(gen_random_uuid()::text, '-', '')`),
  rescheduledFromId: uuid('rescheduled_from_id').references((): AnyPgColumn => meetings.id, { onDelete: 'set null' }),
  contextJSON: jsonb('context_json').$type<MeetingContext>(),
  flowStateJSON: jsonb('flow_state_json').$type<MeetingFlowState>(),
  agentNotes: text('agent_notes'),
  // Google Calendar sync
  gcalEventId: text('gcal_event_id'),
  gcalEtag: text('gcal_etag'),
  gcalSyncedAt: timestamp('gcal_synced_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => ({
  uniqShareToken: uniqueIndex('meetings_share_token_uniq').on(table.shareToken),
  rescheduledFromIdx: index('meetings_rescheduled_from_idx').on(table.rescheduledFromId),
}))

export const meetingsRelations = relations(meetings, ({ one }) => ({
  owner: one(user, {
    fields: [meetings.ownerId],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [meetings.customerId],
    references: [customers.id],
  }),
  project: one(projects, {
    fields: [meetings.projectId],
    references: [projects.id],
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
  createdAt: true,
  updatedAt: true,
}).extend({
  // Un-omitted: hooks.create.before defaults it from the acting user.
  // Optional so clients don't need to send it (hook fills it in).
  ownerId: z.string().optional(),
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>

import type z from 'zod'

import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { activityEntityTypeEnum, activityTypeEnum } from './meta'

export const activities = pgTable('activities', {
  id,
  type: activityTypeEnum().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  entityType: activityEntityTypeEnum('entity_type'),
  entityId: uuid('entity_id'),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  dueAt: timestamp('due_at', { mode: 'string', withTimezone: true }),
  completedAt: timestamp('completed_at', { mode: 'string', withTimezone: true }),
  gcalEventId: text('gcal_event_id'),
  gcalEtag: text('gcal_etag'),
  gcalSyncedAt: timestamp('gcal_synced_at', { mode: 'string', withTimezone: true }),
  metaJSON: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const activitiesRelations = relations(activities, ({ one }) => ({
  owner: one(user, { fields: [activities.ownerId], references: [user.id] }),
}))

export const selectActivitySchema = createSelectSchema(activities)
export type Activity = z.infer<typeof selectActivitySchema>

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertActivity = z.infer<typeof insertActivitySchema>

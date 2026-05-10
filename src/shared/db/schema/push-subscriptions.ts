import type z from 'zod'
import { relations } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'

// One row per (user, browser/device). The push service `endpoint` is the
// natural unique key — Apple/Google rotate them, so we upsert on conflict
// and reassign to the current user (handles shared devices). Subscriptions
// are deleted on 4xx from the push service (dead/expired) and on user
// signout via the unsubscribe mutation.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id,
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  platform: text('platform'),
  createdAt,
  updatedAt,
  lastSuccessAt: timestamp('last_success_at', { mode: 'string', withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { mode: 'string', withTimezone: true }),
}, table => [
  uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
  index('push_subscriptions_user_id_idx').on(table.userId),
])

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [pushSubscriptions.userId],
    references: [user.id],
  }),
}))

export const selectPushSubscriptionSchema = createSelectSchema(pushSubscriptions)
export type PushSubscriptionRow = z.infer<typeof selectPushSubscriptionSchema>

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>

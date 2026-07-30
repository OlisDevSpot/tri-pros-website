import { relations } from 'drizzle-orm'
import { integer, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

import { unsafeId } from '@/shared/db/lib/schema-helpers'
import { applications } from './applications'
import { trades } from './trades'

export const x_applicationTrades = pgTable('x_application_trades', {
  id: unsafeId,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  tradeId: integer('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
}, table => [
  unique('application_id_trade_id_unique').on(table.applicationId, table.tradeId),
])

export const applicationTradesRelations = relations(x_applicationTrades, ({ one }) => ({
  application: one(applications, {
    fields: [x_applicationTrades.applicationId],
    references: [applications.id],
  }),
  trade: one(trades, {
    fields: [x_applicationTrades.tradeId],
    references: [trades.id],
  }),
}))

export type X_ApplicationTrade = typeof x_applicationTrades.$inferSelect
export type X_ApplicationTradeInsert = typeof x_applicationTrades.$inferInsert

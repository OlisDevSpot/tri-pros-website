import { relations } from 'drizzle-orm'
import { pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'

import { unsafeId } from '@/shared/db/lib/schema-helpers'
import { applications } from './applications'

// A homeowner's selected trades on an application. Trades are NOTION-managed —
// Notion is the runtime source of truth and trade ids are Notion page UUIDs
// (strings), NOT the static-seed Postgres `trades.id`. So `tradeId` is a text
// Notion id with NO FK to `trades` (mirrors x_project_scopes.scopeId), and
// `tradeName` snapshots the label at submit for display (Notion names drift).
// Committed from the reserved trades answer key on submit.
// see src/shared/entities/applications/DOCS.md#trades-question-key-seam
export const x_applicationTrades = pgTable('x_application_trades', {
  id: unsafeId,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  tradeId: text('trade_id').notNull(),
  tradeName: text('trade_name').notNull(),
}, table => [
  unique('application_id_trade_id_unique').on(table.applicationId, table.tradeId),
])

export const applicationTradesRelations = relations(x_applicationTrades, ({ one }) => ({
  application: one(applications, {
    fields: [x_applicationTrades.applicationId],
    references: [applications.id],
  }),
}))

export type X_ApplicationTrade = typeof x_applicationTrades.$inferSelect
export type X_ApplicationTradeInsert = typeof x_applicationTrades.$inferInsert

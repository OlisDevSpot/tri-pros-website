import { relations } from 'drizzle-orm'
import { integer, pgTable, unique } from 'drizzle-orm/pg-core'

import { unsafeId } from '@/shared/db/lib/schema-helpers'
import { benefits } from './benefits'
import { trades } from './trades'

export const x_tradeBenefits = pgTable('x_trade_benefits', {
  id: unsafeId,
  tradeId: integer('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
  benefitId: integer('benefit_id')
    .notNull()
    .references(() => benefits.id, { onDelete: 'cascade' }),
}, table => [
  unique('trade_id_benefit_id_unique').on(table.tradeId, table.benefitId),
])

export const tradeBenefitRelations = relations(
  x_tradeBenefits,
  ({ one }) => ({
    trade: one(trades, {
      fields: [x_tradeBenefits.tradeId],
      references: [trades.id],
    }),
    benefit: one(benefits, {
      fields: [x_tradeBenefits.benefitId],
      references: [benefits.id],
    }),
  }),
)

export type X_TradeBenefit = typeof x_tradeBenefits.$inferSelect
export type X_TradeBenefitInsert = typeof x_tradeBenefits.$inferInsert

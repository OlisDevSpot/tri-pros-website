import type z from 'zod'

import { relations } from 'drizzle-orm'
import { pgTable, varchar } from 'drizzle-orm/pg-core'

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { accessor, description, imageUrl, label, outcomeStatement, unsafeId } from '@/db/lib/schema-helpers'

import { addons } from './addons'
import { locationEnum } from './meta'
import { scopes } from './scopes'
import { x_tradeBenefits } from './x-trade-benefits'

export const trades = pgTable('trade', {
  id: unsafeId,
  label,
  accessor: accessor.unique(),
  description,
  outcomeStatement,
  imageUrl,
  slug: varchar({ length: 80 }).notNull(),
  location: locationEnum('location').notNull(),
})

export const tradeRelations = relations(trades, ({ many }) => ({
  scopes: many(scopes),
  addons: many(addons),
  x_tradeBenefits: many(x_tradeBenefits),
}))

export const selectTradeSchema = createSelectSchema(trades)
export type Trade = z.infer<typeof selectTradeSchema>

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
})
export type InsertTrade = z.infer<typeof insertTradeSchema>

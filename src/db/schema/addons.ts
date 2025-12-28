import type z from 'zod'

import { relations } from 'drizzle-orm'
import { integer, pgTable } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { accessor, description, imageUrl, label, outcomeStatement, unsafeId } from '@/db/lib/schema-helpers'
import { trades } from './trades'

export const addons = pgTable('addons', {
  id: unsafeId,
  label,
  accessor: accessor.unique(),
  description,
  outcomeStatement,
  imageUrl,
  tradeId: integer('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
})

export const addonRelations = relations(addons, ({ one }) => ({
  trade: one(trades, {
    fields: [addons.tradeId],
    references: [trades.id],
  }),
}))

export const selectAddonSchema = createSelectSchema(addons)
export type Addon = z.infer<typeof selectAddonSchema>

export const insertAddonSchema = createInsertSchema(addons).omit({
  id: true,
})
export type InsertAddon = z.infer<typeof insertAddonSchema>

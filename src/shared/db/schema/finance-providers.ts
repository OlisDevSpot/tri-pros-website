import type z from 'zod'
import { relations } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '../lib/schema-helpers'
import { financeOptions } from './finance-options'

export const financeProviders = pgTable('finance_providers', {
  id: unsafeId,
  label: text('label').notNull(),
  accessor: text('accessor').notNull().unique(),
  logo: text('logo'),
})

export const financeProviderRelations = relations(
  financeProviders,
  ({ many }) => ({
    financeOptions: many(financeOptions),
  }),
)

export const selectFinanceProviderSchema = createSelectSchema(financeProviders)
export type FinanceProvider = z.infer<typeof selectFinanceProviderSchema>

export const insertFinanceProviderSchema = createInsertSchema(financeProviders).omit({
  id: true,
})
export type InsertFinanceProvider = z.infer<typeof insertFinanceProviderSchema>

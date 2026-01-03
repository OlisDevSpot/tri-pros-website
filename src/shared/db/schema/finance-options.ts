import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, pgTable, real, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '../lib/schema-helpers'
import { financeProviders } from './finance-providers'

export const financeOptions = pgTable('finance_options', {
  id: unsafeId,
  label: text('label').notNull(),
  accessor: text('accessor').notNull().unique(),
  sortOrder: integer('sort_order').notNull(),
  financeProviderId: integer('finance_provider')
    .notNull()
    .references(() => financeProviders.id, { onDelete: 'cascade' }),
  termInMonths: integer('term_in_months').notNull(),
  interestRate: real('interest_rate').notNull(),
})

export const financeOptionsRelations = relations(
  financeOptions,
  ({ one }) => ({
    financeOptions: one(financeProviders, {
      fields: [financeOptions.financeProviderId],
      references: [financeProviders.id],
    }),
  }),
)

export const selectFinanceOptionSchema = createSelectSchema(financeOptions)
export type FinanceOption = z.infer<typeof selectFinanceOptionSchema>

export const insertFinanceOptionSchema = createInsertSchema(financeOptions).omit({
  id: true,
})
export type InsertFinanceOption = z.infer<typeof insertFinanceOptionSchema>

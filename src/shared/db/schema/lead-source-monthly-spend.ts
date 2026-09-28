import type z from 'zod'
import { sql } from 'drizzle-orm'
import { bigint, check, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { leadSourcesTable } from './lead-sources'

// One row per source per Pacific business month ('YYYY-MM'). No row means
// "not entered", which analytics treats differently from $0.
export const leadSourceMonthlySpendTable = pgTable('lead_source_monthly_spend', {
  id,
  leadSourceId: uuid('lead_source_id').notNull().references(() => leadSourcesTable.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('lead_source_monthly_spend_source_month_unique').on(table.leadSourceId, table.month),
  check('lead_source_monthly_spend_amount_ck', sql`${table.amountCents} >= 0`),
  check('lead_source_monthly_spend_month_ck', sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
])

export const selectLeadSourceMonthlySpendSchema = createSelectSchema(leadSourceMonthlySpendTable)
export type LeadSourceMonthlySpend = z.infer<typeof selectLeadSourceMonthlySpendSchema>

export const insertLeadSourceMonthlySpendSchema = createInsertSchema(leadSourceMonthlySpendTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertLeadSourceMonthlySpend = z.infer<typeof insertLeadSourceMonthlySpendSchema>

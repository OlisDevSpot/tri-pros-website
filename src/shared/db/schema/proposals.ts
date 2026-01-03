import type z from 'zod'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { financeOptions } from './finance-options'
import { projectTypeEnum } from './meta'

export const proposals = pgTable('proposals', {
  id,
  label,

  // PROJECT INFO
  projectType: projectTypeEnum('project_type').notNull().default('general-remodeling'),
  timeAllocated: text('time_allocated').notNull(),
  sowSummary: text('sow_summary'),

  // CUSTOMER INFO
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' }),
  hubspotContactVid: text('hubspot_contact_vid'),
  hubspotDealVid: text('hubspot_deal_vid'),
  customerAge: integer('customer_age').notNull(),

  // FUNDING INFO
  tcp: integer('tcp').notNull().default(0),
  depositAmount: integer('deposit_amount').notNull().default(0),
  cashInDeal: integer('cash_in_deal').notNull().default(1000),
  financeOptionId: integer('finance_option_id')
    .references(() => financeOptions.id, { onDelete: 'cascade' }),

  createdAt,
  updatedAt,
})

export const selectProposalSchema = createSelectSchema(proposals)
export type SelectProposalSchema = z.infer<typeof selectProposalSchema>

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

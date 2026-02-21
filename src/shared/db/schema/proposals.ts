import type z from 'zod'
import type { HomeArea } from '@/shared/types/enums'
import type { SOW } from '@/shared/types/sow'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgEnum, pgTable, text, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { financeOptions } from './finance-options'
import { projectTypeEnum } from './meta'

const proposalStatuses = ['draft', 'sent', 'approved', 'declined'] as const

export type ProposalStatus = typeof proposalStatuses[number]
export const proposalStatusEnum = pgEnum('proposal_status', proposalStatuses)

export const proposals = pgTable('proposals', {
  id,
  label,
  status: proposalStatusEnum('status').notNull().default('draft'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),

  // PROJECT SUMMARY
  projectSummary: text('project_summary'),
  energyBenefits: text('energy_benefits'),
  projectObjectives: jsonb('project_objectives').$type<string[]>(),
  homeAreasUpgrades: jsonb('home_areas_upgrades').$type<HomeArea[]>(),
  sow: jsonb('sow').$type<SOW[]>(),

  // PROJECT INFO
  projectType: projectTypeEnum('project_type').notNull().default('general-remodeling'),
  timeAllocated: text('time_allocated').notNull(),
  agreementNotes: text('sow_summary'),

  // HOMEOWNER INFO
  name: text('name').notNull(),
  email: text('email').notNull(),
  phoneNum: text('phone_num').notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 64 }).notNull(),
  state: varchar('state', { length: 2 }).notNull().default('CA'),
  zipCode: varchar('zip_code', { length: 5 }).notNull(),
  customerAge: integer('customer_age').notNull(),

  // FUNDING INFO
  tcp: integer('tcp').notNull().default(0),
  depositAmount: integer('deposit_amount').notNull().default(0),
  discounts: jsonb('discounts').$type<{ reason: string, amount: number }[]>(),
  cashInDeal: integer('cash_in_deal').notNull().default(1000),
  financeOptionId: integer('finance_option_id')
    .references(() => financeOptions.id, { onDelete: 'cascade' }),

  // NOTION
  notionPageId: text('notion_page_id'),

  // HUBSPOT
  hubspotContactVid: text('hubspot_contact_vid'),
  hubspotDealVid: text('hubspot_deal_vid'),

  createdAt,
  updatedAt,
})

export const proposalsRelations = relations(proposals, ({ one }) => ({
  owner: one(user, {
    fields: [proposals.ownerId],
    references: [user.id],
  }),
  financeOption: one(financeOptions, {
    fields: [proposals.financeOptionId],
    references: [financeOptions.id],
  }),
}))

export const selectProposalSchema = createSelectSchema(proposals)
export type Proposal = z.infer<typeof selectProposalSchema>

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  token: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

import type z from 'zod'
import type { FundingSection, HomeownerSection, ProjectSection } from '@/shared/entities/proposals/types'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { fundingSectionSchema, homeownerSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { financeOptions } from './finance-options'

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
  notionPageId: text('notion_page_id'),

  homeownerJSON: jsonb('homeowner_JSON').$type<HomeownerSection>().notNull(),
  projectJSON: jsonb('project_JSON').$type<ProjectSection>().notNull(),
  fundingJSON: jsonb('funding_JSON').$type<FundingSection>().notNull(),

  financeOptionId: integer('finance_option_id')
    .references(() => financeOptions.id, { onDelete: 'cascade' }),

  docusignEnvelopeId: text('docusign_envelope_id'),
  contractSentAt: timestamp('contract_sent_at', { mode: 'string', withTimezone: true }),

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

export const selectProposalSchema = createSelectSchema(proposals, {
  homeownerJSON: homeownerSectionSchema,
  projectJSON: projectSectionSchema,
  fundingJSON: fundingSectionSchema,
})
export type Proposal = z.infer<typeof selectProposalSchema>

export const insertProposalSchema = createInsertSchema(proposals, {
  homeownerJSON: homeownerSectionSchema,
  projectJSON: projectSectionSchema,
  fundingJSON: fundingSectionSchema,
}).omit({
  id: true,
  token: true,
  createdAt: true,
  updatedAt: true,
})

export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

import type z from 'zod'
import type { ProposalStatus } from '@/shared/constants/enums'
import type { FormMetaSection, FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { financeOptions } from './finance-options'
import { meetings } from './meetings'
import { proposalStatusEnum } from './meta'

export type { ProposalStatus }

export const proposals = pgTable('proposals', {
  id,
  label,
  status: proposalStatusEnum('status').notNull().default('draft'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  signingRequestId: text('signing_request_id'),
  qbInvoiceId: text('qb_invoice_id'),
  qbPaymentStatus: text('qb_payment_status'),

  formMetaJSON: jsonb('form_meta_JSON').$type<FormMetaSection>().notNull(),
  projectJSON: jsonb('project_JSON').$type<ProjectSection>().notNull(),
  fundingJSON: jsonb('funding_JSON').$type<FundingSection>().notNull(),

  meetingId: uuid('meeting_id')
    .references(() => meetings.id, { onDelete: 'set null' }),
  financeOptionId: integer('finance_option_id')
    .references(() => financeOptions.id, { onDelete: 'cascade' }),

  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  contractSentAt: timestamp('contract_sent_at', { mode: 'string', withTimezone: true }),
  contractViewedAt: timestamp('contract_viewed_at', { mode: 'string', withTimezone: true }),
  contractSignedAt: timestamp('contract_signed_at', { mode: 'string', withTimezone: true }),
  contractDeclinedAt: timestamp('contract_declined_at', { mode: 'string', withTimezone: true }),
  approvedAt: timestamp('approved_at', { mode: 'string', withTimezone: true }),
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
  meeting: one(meetings, {
    fields: [proposals.meetingId],
    references: [meetings.id],
  }),
}))

export const selectProposalSchema = createSelectSchema(proposals, {
  projectJSON: projectSectionSchema,
  fundingJSON: fundingSectionSchema,
})
export type Proposal = z.infer<typeof selectProposalSchema>

export const insertProposalSchema = createInsertSchema(proposals, {
  projectJSON: projectSectionSchema,
  fundingJSON: fundingSectionSchema,
}).omit({
  id: true,
  token: true,
  updatedAt: true,
})

export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

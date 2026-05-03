import type z from 'zod'
import type { ProposalStatus } from '@/shared/constants/enums'
import type { FormMetaSection, FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { relations, sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { financeOptions } from './finance-options'
import { meetings } from './meetings'
import { proposalKindEnum, proposalStatusEnum } from './meta'

export type { ProposalStatus }

export const proposals = pgTable('proposals', {
  id,
  label,
  status: proposalStatusEnum('status').notNull().default('draft'),
  // Frozen at insert: 'initial-sale' if the proposal's meeting has no
  // project yet, 'additional-work' if it does. See createProposal DAL for
  // the derivation. Drives Zoho envelope assembly + project-creation
  // gating in the proposal table.
  kind: proposalKindEnum('kind').notNull().default('initial-sale'),
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
  approvedAt: timestamp('approved_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  // At most one initial-sale per meeting. Combined with the immutability
  // of `kind` and the server-side derivation rule
  // (kind = meeting.projectId IS NULL ? 'initial-sale' : 'additional-work'),
  // this transitively enforces "1 initial-sale per project" — a project's
  // first meeting can yield exactly one initial-sale proposal, and
  // projects only exist on initial-sale approval.
  uniqueIndex('proposals_one_initial_sale_per_meeting_idx')
    .on(table.meetingId)
    .where(sql`kind = 'initial-sale'`),
])

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
  // `kind` is server-derived (see createProposal DAL) — never accepted from
  // clients. Frozen at insert; updateProposal must not change it either.
  kind: true,
})

export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

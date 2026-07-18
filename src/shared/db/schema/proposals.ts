import type { ProposalStatus } from '@/shared/constants/enums'
import type { FormMetaSection, FundingSection, ProjectSection } from '@/shared/entities/proposals/types'

import { relations, sql } from 'drizzle-orm'
import { bigint, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'

import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { financeOptions } from './finance-options'
import { meetings } from './meetings'

export type { ProposalStatus }

export const proposals = pgTable('proposals', {
  id,
  label,
  status: text('status', { enum: proposalStatuses }).notNull().default('draft'),
  // Frozen at insert: 'initial-sale' if the proposal's meeting has no
  // project yet, 'additional-work' if it does. See createProposal DAL for
  // the derivation. Drives Zoho envelope assembly + project-creation
  // gating in the proposal table.
  kind: text('kind', { enum: proposalKinds }).notNull().default('initial-sale'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  // `contractEnvelope` is the canonical domain term (2026-07-18 ruling): the
  // legal snapshot of the agreement, held in Zoho Sign. Column renames to
  // `contract_envelope_id` with the Wave-3 prod push — see the deprecation
  // ledger's seam-tightening register.
  contractEnvelopeId: text('signing_request_id'),
  qbInvoiceId: text('qb_invoice_id'),
  qbPaymentStatus: text('qb_payment_status'),

  formMetaJSON: jsonb('form_meta_JSON').$type<FormMetaSection>().notNull(),
  projectJSON: jsonb('project_JSON').$type<ProjectSection>().notNull(),
  fundingJSON: jsonb('funding_JSON').$type<FundingSection>().notNull(),

  // Stage-2 rollup cache (Addendum A.2): recomputed by the SINGLE choke point
  // recomputeProposalFinancials after every financial mutation. Idempotent +
  // self-healing (re-running always converges from rows). Nullable only for
  // the backfill window — treat null as "not yet computed", never as $0-truth.
  finalTcpCents: bigint('final_tcp_cents', { mode: 'number' }),
  // Bumped when the TCP formula or rounding policy changes; changelog in
  // ../entities/proposals/DOCS.md#final-tcp-derived. v1 = 2026-07-09 ruling.
  calcVersion: integer('calc_version').notNull().default(1),

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
}, table => [
  // At most one APPROVED initial-sale per meeting. Because the runtime
  // derivation freezes kind from `meeting.projectId` at insert time, all
  // initial-sale proposals for a single project live on the project's
  // birthing meeting (the earliest meeting linked to it). So per-meeting
  // uniqueness on (kind='initial-sale', status='approved') transitively
  // enforces "at most one approved initial-sale per project" — the real
  // business invariant. Many sent/draft initial-sales on the birthing
  // meeting (the agent iterating on an offer) coexist freely.
  uniqueIndex('proposals_one_approved_initial_sale_per_meeting_idx')
    .on(table.meetingId)
    .where(sql`kind = 'initial-sale' AND status = 'approved'`),
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
  updatedAt: true,
  finalTcpCents: true,
  calcVersion: true,
}).extend({
  // Server-derived fields: hooks.create.before sets these. Optional so
  // clients don't send them (hook fills in), but Zod doesn't strip them.
  // see ../entities/proposals/DOCS.md#kind-derived-from-meeting-project
  // see ../entities/proposals/DOCS.md#share-token-generated-at-insert
  kind: z.enum(['initial-sale', 'additional-work']).optional(),
  token: z.string().optional(),
})

export type InsertProposalSchema = z.infer<typeof insertProposalSchema>

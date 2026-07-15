import type z from 'zod'
import { sql } from 'drizzle-orm'
import { bigint, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { incentiveTypes } from '@/shared/entities/proposals/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { proposals } from './proposals'

// Global proposal incentives as SUMmable rows (typed financial line items are
// NEVER JSONB — Addendum B). sow_item_id is present-but-unused in W2 (always
// NULL = global incentive); W3 adds the proposal_sow_items FK and migrates
// section incentives in (Addendum A.3). label is NULL for global rows today —
// W3 section rows use it. Money = integer cents at the DAL boundary.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §2
export const proposalIncentives = pgTable('proposal_incentives', {
  id,
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  sowItemId: uuid('sow_item_id'),
  type: text('type', { enum: incentiveTypes }).notNull(),
  position: integer('position').notNull(),
  label: text('label'),
  amountCents: bigint('amount_cents', { mode: 'number' }),
  offer: text('offer'),
  notes: text('notes'),
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  check('proposal_incentives_discount_amount_ck', sql`${table.type} <> 'discount' OR ${table.amountCents} IS NOT NULL`),
  check('proposal_incentives_offer_ck', sql`${table.type} <> 'exclusive-offer' OR ${table.offer} IS NOT NULL`),
])

export const selectProposalIncentiveSchema = createSelectSchema(proposalIncentives)
export type ProposalIncentiveRow = z.infer<typeof selectProposalIncentiveSchema>

export const insertProposalIncentiveSchema = createInsertSchema(proposalIncentives)
  .omit({ id: true, createdAt: true, updatedAt: true })
export type InsertProposalIncentive = z.infer<typeof insertProposalIncentiveSchema>

import type z from 'zod'
import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { viewSourceEnum } from './meta'
import { proposals } from './proposals'

export const proposalViews = pgTable('proposal_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id')
    .notNull()
    .references(() => proposals.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  source: viewSourceEnum('source').notNull().default('unknown'),
  referer: text('referer'),
})

export const proposalViewsRelations = relations(proposalViews, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalViews.proposalId],
    references: [proposals.id],
  }),
}))

export const selectProposalViewSchema = createSelectSchema(proposalViews)
export type ProposalView = z.infer<typeof selectProposalViewSchema>

export const insertProposalViewSchema = createInsertSchema(proposalViews).omit({
  id: true,
  viewedAt: true,
})
export type InsertProposalView = z.infer<typeof insertProposalViewSchema>

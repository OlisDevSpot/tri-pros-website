import { relations } from 'drizzle-orm'
import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { applications } from './applications'

// Committed answers, exploded from applications.draft_answers_JSON on submit.
// ADR-0005 "dynamic-key map" sub-entity: UNIQUE(application_id, question_key).
// `value` is a stringified scalar; the review panel resolves prompt + type
// from the live step registry (no label snapshot — ruled 2026-07-30). Trades
// do NOT live here — they route to x_application_trades.
export const applicationAnswers = pgTable('application_answers', {
  id,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  questionKey: text('question_key').notNull(),
  value: text('value').notNull(),
  position: integer('position').notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('application_id_question_key_unique').on(table.applicationId, table.questionKey),
])

export const applicationAnswersRelations = relations(applicationAnswers, ({ one }) => ({
  application: one(applications, {
    fields: [applicationAnswers.applicationId],
    references: [applications.id],
  }),
}))

export type ApplicationAnswer = typeof applicationAnswers.$inferSelect
export type InsertApplicationAnswer = typeof applicationAnswers.$inferInsert

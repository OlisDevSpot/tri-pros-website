import type z from 'zod'
import type { ApplicationDraft } from '@/shared/entities/applications/schemas'
import type { ApplicationStatus, ApplicationType } from '@/shared/types/enums'

import { relations, sql } from 'drizzle-orm'
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { applicationStatuses, applicationTypes } from '@/shared/constants/enums'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { meetings } from './meetings'

export type { ApplicationStatus, ApplicationType }

export const applications = pgTable('applications', {
  id,
  type: text('type', { enum: applicationTypes }).notNull(),
  status: text('status', { enum: applicationStatuses }).notNull().default('draft'),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),

  // In-progress engine-state snapshot: { _v, currentStepId, history, answers }.
  // Sub-project #2's DB StepPersistenceAdapter load/persists THIS. Scratch only —
  // committed answers become the source of truth on submit. Nullable until the
  // engine's first autosave. Zod-validated at the write boundary (not by .$type).
  draftAnswersJSON: jsonb('draft_answers_JSON').$type<ApplicationDraft>(),

  submittedAt: timestamp('submitted_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  // Any post-draft, non-withdrawn status implies a submission happened.
  // Sub-project #3 tightens this when approved/rejected transitions land.
  check(
    'applications_submitted_at_ck',
    sql`${table.status} IN ('draft', 'withdrawn') OR ${table.submittedAt} IS NOT NULL`,
  ),
])

// Only the FK-target relation is declared here (mirrors proposals.ts, which
// declares owner/financeOption/meeting but NOT its children). The child→parent
// `one()` relations live in the child files. This keeps applications.ts from
// importing its children → no circular import; getApplicationWithAnswers uses
// explicit selects, not relational queries, so the `many` side is unneeded.
export const applicationsRelations = relations(applications, ({ one }) => ({
  meeting: one(meetings, {
    fields: [applications.meetingId],
    references: [meetings.id],
  }),
}))

// draftAnswersJSON is a nullable column with no default → nullable in select,
// and optional+nullable in insert (so `create({ type, meetingId })` is valid).
// The drizzle-zod override replaces the field schema, so re-assert nullability
// explicitly — otherwise a bare `applicationDraftSchema` would make it required.
export const selectApplicationSchema = createSelectSchema(applications, {
  draftAnswersJSON: applicationDraftSchema.nullable(),
})
export type Application = z.infer<typeof selectApplicationSchema>

// status and submittedAt are server-derived, not client-writable: status
// defaults to 'draft' at the column, and submittedAt is set only by
// submitApplication (dal/server/mutations.ts, via raw db.update — it bypasses
// this schema entirely). Omitting them here means the generic crud.create /
// crud.update procedures (whose update schema is this schema's `.partial()`)
// can never write status/submittedAt — status movement stays exclusively
// with the four lifecycle verbs (create/saveDraft/submit/withdraw).
export const insertApplicationSchema = createInsertSchema(applications, {
  draftAnswersJSON: applicationDraftSchema.nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  submittedAt: true,
})
export type InsertApplicationSchema = z.infer<typeof insertApplicationSchema>

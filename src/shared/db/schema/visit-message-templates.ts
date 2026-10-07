import type z from 'zod'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'

// A row exists only for wording a super-admin edited. The defaults live in code, and resetting deletes the row.
export const visitMessageTemplates = pgTable('visit_message_templates', {
  key: text('key', { enum: visitMessageTemplateKeys }).primaryKey(),
  body: text('body').notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const selectVisitMessageTemplateSchema = createSelectSchema(visitMessageTemplates)
export type VisitMessageTemplate = z.infer<typeof selectVisitMessageTemplateSchema>

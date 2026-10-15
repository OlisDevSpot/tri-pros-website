import type z from 'zod'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import { createdAt } from '../lib/schema-helpers'
import { user } from './auth'

// A row means that automatic kind is paused for every meeting. Resuming deletes it.
export const visitMessagePauses = pgTable('visit_message_pauses', {
  kind: text('kind', { enum: pausableVisitMessageKinds }).primaryKey(),
  pausedByUserId: text('paused_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
})

export const selectVisitMessagePauseSchema = createSelectSchema(visitMessagePauses)
export type VisitMessagePause = z.infer<typeof selectVisitMessagePauseSchema>

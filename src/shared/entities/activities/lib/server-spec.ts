import { z } from 'zod'

import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { activities, insertActivitySchema, selectActivitySchema } from '@/shared/db/schema/activities'
import { ACTIVITY } from './constants'

const metaJSON = z.record(z.string(), z.unknown()).nullish()
// The owner is stamped on create and never moves; the calendar columns are the sync's to write.
const insertActivitySchemaOwned = insertActivitySchema.partial({ ownerId: true }).extend({ metaJSON })
const updateActivitySchema = insertActivitySchema
  .pick({ type: true, title: true, description: true, entityType: true, entityId: true, scheduledFor: true, dueAt: true, completedAt: true })
  .extend({ metaJSON })
  .partial()

/** A link is a type and an id together; half of one points at nothing. */
export function isWholeLink(link: { entityType?: string | null, entityId?: string | null }): boolean {
  return (link.entityType == null) === (link.entityId == null)
}

export const activityServerSpec = defineEntitySpec({
  entityName: ACTIVITY,
  subject: ACTIVITY,
  conditionColumns: ['ownerId'],
  table: activities,
  schemas: {
    insert: insertActivitySchemaOwned,
    update: updateActivitySchema,
    select: selectActivitySchema,
  },
})

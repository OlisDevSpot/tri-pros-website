import { and, eq, isNull, or } from 'drizzle-orm'

import { activityEntityTypes } from '@/shared/constants/enums'
import { activities } from '@/shared/db/schema/activities'
import { LINKED_RECORD_SPECS } from '@/shared/entities/activities/lib/linked-record-specs'

import { defineOperator } from '../operators'

// A link is a type and an id, so each type is matched against its own table under the reader's read
// rules for it. Half a link points at nothing and blocks nothing.
defineOperator({
  name: 'linkedRecordInReach',
  toSql: (_node, ctx) => {
    if (ctx.table !== activities) {
      throw new Error('[permit] $linkedRecordInReach sits on Activity only')
    }
    const linked = activityEntityTypes.map(type =>
      and(eq(activities.entityType, type), ctx.inReadReach(LINKED_RECORD_SPECS[type], activities.entityId))!)
    return or(isNull(activities.entityType), isNull(activities.entityId), ...linked)!
  },
})

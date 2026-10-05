import { desc, inArray } from 'drizzle-orm'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { activities } from '@/shared/db/schema/activities'
import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import 'server-only'

export const ACTIVITY_FIELD_SQL = defineFieldSql(ACTIVITY_FIELDS, {
  filter: {
    type: v => inArray(activities.type, v),
    entityType: v => inArray(activities.entityType, v),
    ownerId: v => inArray(activities.ownerId, v),
    scheduledFor: v => dateRangeCondition(activities.scheduledFor, v),
  },
  sort: {
    type: activities.type,
    scheduledFor: activities.scheduledFor,
    title: activities.title,
    dueAt: activities.dueAt,
    createdAt: activities.createdAt,
  },
}, { defaultOrder: [desc(activities.createdAt)], tieBreaker: activities.id })

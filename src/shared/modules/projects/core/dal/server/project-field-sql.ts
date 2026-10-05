import { desc, eq, inArray, sql } from 'drizzle-orm'

import { stagesForBuckets } from '@/shared/constants/enums'
import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import { hasAssociatedMeeting } from '@/shared/modules/projects/core/lib/visibility'
import 'server-only'

export const PROJECT_FIELD_SQL = defineFieldSql(PROJECT_FIELDS, {
  filter: {
    // Null stage groups with Completed, as deriveProjectStatusBucket does.
    statusBucket: v => (v.length > 0 ? inArray(sql`coalesce(${projects.pipelineStage}, 'closed')`, stagesForBuckets(v)) : undefined),
    visibility: v => eq(projects.isPublic, v === 'public'),
    completedAt: v => dateRangeCondition(projects.completedAt, v),
    createdAt: v => dateRangeCondition(projects.createdAt, v),
    excludePortfolio: v => (v ? hasAssociatedMeeting() : undefined),
  },
  sort: {
    title: projects.title,
    // Needs the customers join, which the page query always has.
    customerName: customers.name,
    city: projects.city,
    visibility: projects.isPublic,
    completedAt: projects.completedAt,
    createdAt: projects.createdAt,
  },
}, { defaultOrder: [desc(projects.createdAt)], tieBreaker: projects.id })

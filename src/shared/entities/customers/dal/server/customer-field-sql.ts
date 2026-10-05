import { desc, eq, inArray, sql } from 'drizzle-orm'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { buildSegmentWhere } from '@/shared/entities/lead-sources/lib/segment-sql'
import 'server-only'

export const CUSTOMER_FIELD_SQL = defineFieldSql(CUSTOMER_FIELDS, {
  filter: {
    pipeline: v => derivedPipelineWhere(v),
    createdAt: v => dateRangeCondition(customers.createdAt, v),
    // The subquery's own `meetings` shadows any outer one (the fresh kanban joins meetings), so it always correlates on the customer.
    rep: v => sql`EXISTS (SELECT 1 FROM ${meetings} INNER JOIN ${meetingParticipants} ON ${meetingParticipants.meetingId} = ${meetings.id} WHERE ${meetings.customerId} = ${customers.id} AND ${inArray(meetingParticipants.userId, v)})`,
    leadSource: v => inArray(customers.leadSourceId, v),
    sourceId: v => eq(customers.leadSourceId, v),
    segment: v => buildSegmentWhere(v),
  },
  sort: {
    createdAt: customers.createdAt,
    leadSource: leadSourcesTable.name,
    name: customers.name,
    email: customers.email,
  },
}, { defaultOrder: [desc(customers.createdAt)], tieBreaker: customers.id })

// Local source: appointments (distinct customers with ≥1 meeting) per adKey in range,
// scoped to paid Meta ad clicks.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { source } from '../../types'
import { brandedMetaPaidScope } from './branded-meta-scope'

export const appointmentsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        appointments: sql<number>`COUNT(DISTINCT ${meetings.customerId})::int`,
      })
      .from(meetings)
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(and(
        brandedMetaPaidScope,
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(meetings.createdAt, range.start.toISOString()),
        lte(meetings.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map(r => ({ adKey: r.adKey as string, appointments: r.appointments }))
  },
})

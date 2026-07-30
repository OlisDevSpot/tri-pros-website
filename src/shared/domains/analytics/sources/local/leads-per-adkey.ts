// Local source: first-party lead count per adKey (paid Meta attribution rows in range).
// Module-level singleton for resolver dedup. Raw db aggregation (domain, not service).
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { source } from '../../types'
import { brandedMetaPaidScope } from './branded-meta-scope'

export const leadsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        leads: sql<number>`COUNT(${customerLeadAttribution.customerId})::int`,
      })
      .from(customerLeadAttribution)
      .innerJoin(customers, eq(customers.id, customerLeadAttribution.customerId))
      .where(and(
        brandedMetaPaidScope,
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(customers.createdAt, range.start.toISOString()),
        lte(customers.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map(r => ({ adKey: r.adKey as string, leads: r.leads }))
  },
})

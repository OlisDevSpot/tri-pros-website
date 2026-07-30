// Local source: signed customers (≥1 project) per adKey in range, scoped to paid Meta.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'
import { source } from '../../types'
import { brandedMetaPaidScope } from './branded-meta-scope'

export const signedPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        signed: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
      })
      .from(customers)
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(and(
        brandedMetaPaidScope,
        isSignedCustomerSql(),
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(customers.createdAt, range.start.toISOString()),
        lte(customers.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map(r => ({ adKey: r.adKey as string, signed: r.signed }))
  },
})

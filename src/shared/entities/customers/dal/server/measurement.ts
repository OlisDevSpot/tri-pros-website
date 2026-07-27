import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution, customers } from '@/shared/db/schema'

/**
 * Read surface for the delayed CRM→CAPI Schedule event. One joined read: the
 * customer's identity match keys + the immutable funnel attribution snapshot.
 * see docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md §2
 */
export async function getCustomerForMeasurement(customerId: string) {
  const [row] = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
      leadId: customers.leadId,
      metaScheduleSentAt: customers.metaScheduleSentAt,
      attributionKind: customerLeadAttribution.kind,
      funnelSlug: customerLeadAttribution.funnelSlug,
      captureJSON: customerLeadAttribution.captureJSON,
    })
    .from(customers)
    .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
    .where(eq(customers.id, customerId))
    .limit(1)
  return row ?? null
}

export async function markMetaScheduleSent(customerId: string, sentAtIso: string): Promise<void> {
  await db.update(customers).set({ metaScheduleSentAt: sentAtIso }).where(eq(customers.id, customerId))
}

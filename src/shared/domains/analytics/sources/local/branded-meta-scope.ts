// Branded Meta PAID-ads scope. utm_source=meta AND utm_medium=paid is emitted
// SOLELY by scripts/meta/sync/ad-link.ts (buildUrlTags) — the one signal of a
// paid ad click. Deliberately narrower than customers.leadSourceId='branded-meta-ads'
// (which also includes organic funnel visitors with no attribution). Reused by
// every analytics source + all future Sales/Marketing metrics.
import { and, eq } from 'drizzle-orm'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'

export const brandedMetaPaidScope = and(
  eq(customerLeadAttribution.utmSource, 'meta'),
  eq(customerLeadAttribution.utmMedium, 'paid'),
)

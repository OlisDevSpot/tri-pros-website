import type { InsertCustomerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'

/**
 * Split a capture-time LeadMeta into the attribution child-row shape.
 * `captureJSON` keeps the FULL immutable snapshot minus `source.enrichment`
 * (the one mutable part — it lives exclusively in customer_enrichment rows).
 * Promoted hot fields intentionally remain inside captureJSON too: the
 * snapshot is immutable after capture, so the projection cannot drift.
 */
export function splitLeadMeta(leadMeta: LeadMeta): {
  attribution: Omit<InsertCustomerLeadAttribution, 'customerId'>
  enrichment: EnrichmentRecord
} {
  const funnel = leadMeta.source?.kind === 'funnel' ? leadMeta.source : null
  const capture: LeadMeta = funnel
    ? { ...leadMeta, source: { ...funnel, enrichment: undefined } }
    : leadMeta
  return {
    attribution: {
      kind: leadMeta.source?.kind ?? 'generic',
      funnelSlug: funnel?.funnelSlug ?? null,
      offer: funnel?.offer ?? null,
      utmSource: funnel?.utm.source ?? null,
      utmMedium: funnel?.utm.medium ?? null,
      utmCampaign: funnel?.utm.campaign ?? null,
      utmContent: funnel?.utm.content ?? null,
      utmTerm: funnel?.utm.term ?? null,
      captureJSON: capture,
    },
    enrichment: funnel?.enrichment ?? {},
  }
}

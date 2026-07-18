import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Pure: build a `📋 Funnel intake` note from the self-describing enrichment
// record ({ label, value, order }). No I/O. The legacy flat-shape tolerance
// (Record<string, string>) was deleted in the post-W2 tightening pass — its
// sibling `toRows()` died in 215790be; `EnrichmentRecord` is the only wire
// shape (see docs/plans/jsonb-decomposition-deprecation-ledger.md).

export function buildFunnelLeadNote(leadMeta: LeadMeta | null | undefined): string | null {
  if (leadMeta?.source?.kind !== 'funnel') {
    return null
  }
  const enrichment = leadMeta.source.enrichment
  if (!enrichment) {
    return null
  }

  const rows = Object.values(enrichment)
  if (rows.length === 0) {
    return null
  }
  rows.sort((a, b) => a.order - b.order)

  const lines = ['📋 Funnel intake', ...rows.map(r => `${r.label}: ${r.value}`)]
  return lines.join('\n')
}

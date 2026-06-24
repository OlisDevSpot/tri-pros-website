import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Pure: build a `📋 Funnel intake` note from the generic enrichment record.
// Self-describing entries ({ label, value, order }) need no label mirror.
// Tolerates the legacy flat shape (Record<string, string>) from pre-refactor
// kitchen leads by best-effort rendering of key: value. No I/O.

interface Entry { label: string, value: string, order: number }

function isEntry(v: unknown): v is Entry {
  return typeof v === 'object' && v !== null && 'label' in v && 'value' in v
}

export function buildFunnelLeadNote(leadMeta: LeadMeta | null | undefined): string | null {
  if (leadMeta?.source?.kind !== 'funnel') {
    return null
  }
  const enrichment = leadMeta.source.enrichment as Record<string, unknown> | undefined
  if (!enrichment) {
    return null
  }

  const rows: { label: string, value: string, order: number }[] = []
  for (const [key, raw] of Object.entries(enrichment)) {
    if (isEntry(raw)) {
      rows.push({ label: raw.label, value: raw.value, order: raw.order })
    }
    else if (typeof raw === 'string') {
      // Legacy flat shape: key is the dimension id, value is a raw option id.
      rows.push({ label: key, value: raw, order: rows.length })
    }
  }
  if (rows.length === 0) {
    return null
  }
  rows.sort((a, b) => a.order - b.order)

  const lines = ['📋 Funnel intake', ...rows.map(r => `${r.label}: ${r.value}`)]
  return lines.join('\n')
}

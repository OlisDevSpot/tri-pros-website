import type { LeadMeta } from '@/shared/entities/customers/schemas'

import {
  AGE_LABELS,
  HOME_TYPE_LABELS,
  SCOPE_LABELS,
  TIMELINE_LABELS,
} from '@/shared/domains/funnels/constants/enrichment-labels'

// Pure: build a `📋 Funnel intake` note from the funnel enrichment dimensions.
// Returns null when there is nothing to show (no funnel source, no enrichment
// fields set). No I/O.

function label(map: Record<string, string>, id: string | null | undefined): string | null {
  if (!id) {
    return null
  }
  return map[id] ?? id
}

function pushIf(lines: string[], lineLabel: string, value: string | null | undefined): void {
  if (value) {
    lines.push(`${lineLabel}: ${value}`)
  }
}

export function buildFunnelLeadNote(leadMeta: LeadMeta | null | undefined): string | null {
  if (leadMeta?.source?.kind !== 'funnel') {
    return null
  }

  const enrichment = leadMeta.source.enrichment
  if (!enrichment) {
    return null
  }

  const lines = ['📋 Funnel intake']

  pushIf(lines, 'Home type', label(HOME_TYPE_LABELS, enrichment.homeType))
  pushIf(lines, 'Project age', label(AGE_LABELS, enrichment.age))
  pushIf(lines, 'Scope', label(SCOPE_LABELS, enrichment.scope))
  pushIf(lines, 'Timeline', label(TIMELINE_LABELS, enrichment.timeline))

  return lines.length > 1 ? lines.join('\n') : null
}

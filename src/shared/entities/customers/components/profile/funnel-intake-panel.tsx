import type { LeadMeta } from '@/shared/entities/customers/schemas'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { LEGACY_ENRICHMENT_LABELS } from '@/shared/entities/customers/constants/funnel-intake-fields'

interface Row {
  label: string
  value: string
  order: number
}

function toRows(enrichment: Record<string, unknown>): Row[] {
  const rows: Row[] = []
  for (const [key, raw] of Object.entries(enrichment)) {
    if (typeof raw === 'object' && raw !== null && 'label' in raw && 'value' in raw) {
      const e = raw as { label: string, value: string, order?: number }
      rows.push({ label: e.label, value: e.value, order: e.order ?? rows.length })
    }
    else if (typeof raw === 'string') {
      rows.push({ label: LEGACY_ENRICHMENT_LABELS[key] ?? key, value: raw, order: rows.length })
    }
  }
  return rows.sort((a, b) => a.order - b.order)
}

export function FunnelIntakePanel({ leadMetaJSON }: { leadMetaJSON: LeadMeta | null | undefined }) {
  if (leadMetaJSON?.source?.kind !== 'funnel') {
    return null
  }
  const enrichment = leadMetaJSON.source.enrichment as Record<string, unknown> | undefined
  if (!enrichment) {
    return null
  }
  const rows = toRows(enrichment)
  if (rows.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Funnel Intake</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {rows.map(row => (
            <div key={row.label}>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium">{row.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

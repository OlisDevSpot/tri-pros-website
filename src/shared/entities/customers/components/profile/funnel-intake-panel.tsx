import type { CustomerEnrichmentRow } from '@/shared/db/schema/customer-enrichment'
import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface Props {
  attribution: CustomerLeadAttributionRow | null
  enrichment: CustomerEnrichmentRow[]
}

export function FunnelIntakePanel({ attribution, enrichment }: Props) {
  // Enrichment rows are already `{label,value,order}`-shaped and DB-ordered
  // (queried `ORDER BY "order" ASC`), so they render directly — no normalization.
  if (attribution?.kind !== 'funnel' || enrichment.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Funnel Intake</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {enrichment.map(row => (
            <div key={row.stepId}>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium">{row.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

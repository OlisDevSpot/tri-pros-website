'use client'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'

import { Badge } from '@/shared/components/ui/badge'

export function IdleSourceRow({ summary }: { summary: SourceSummary }) {
  const stats = [
    { label: 'Enrolled', value: summary.enrolledCount },
    { label: 'Eligible', value: summary.eligibleCount },
    { label: 'DNC', value: summary.dncCount },
  ]

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {summary.name}
      </span>
      <div className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums text-muted-foreground sm:gap-3">
        {stats.map(s => (
          <span key={s.label}>
            <span className="hidden sm:inline">{`${s.label} `}</span>
            {s.value.toLocaleString()}
          </span>
        ))}
      </div>
      {summary.defaultCampaignId
        ? <Badge className="shrink-0" variant="secondary">Default set</Badge>
        : <Badge className="shrink-0" variant="outline">No default</Badge>}
    </div>
  )
}

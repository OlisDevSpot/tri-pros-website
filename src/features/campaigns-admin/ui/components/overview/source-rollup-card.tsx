'use client'

import { AlertTriangleIcon } from 'lucide-react'

import { EnrollAllPopover } from '@/features/campaigns-admin/ui/components/overview/enroll-all-popover'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'

interface SourceSummary {
  defaultCampaignId: string | null
  dncCount: number
  eligibleCount: number
  enrolledCount: number
  isActive: boolean
  name: string
  needsBinding: boolean
  sourceSlug: string
}

export function SourceRollupCard({ summary }: { summary: SourceSummary }) {
  const stats = [
    { label: 'Enrolled', value: summary.enrolledCount },
    { label: 'Eligible', value: summary.eligibleCount },
    { label: 'DNC', value: summary.dncCount },
  ]

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{summary.name}</span>
          <span className="text-xs text-muted-foreground">{summary.sourceSlug}</span>
        </div>
        {summary.defaultCampaignId
          ? <Badge variant="secondary">Bound</Badge>
          : <Badge variant="outline">No default</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div
            key={s.label}
            className="flex flex-col"
          >
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {summary.needsBinding && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon
            aria-hidden="true"
            className="size-3.5 shrink-0"
          />
          <span>Has eligible leads but no bound campaign. Set a default in Setup.</span>
        </div>
      )}

      <EnrollAllPopover
        defaultCampaignId={summary.defaultCampaignId}
        eligibleCount={summary.eligibleCount}
        sourceSlug={summary.sourceSlug}
      />
    </Card>
  )
}

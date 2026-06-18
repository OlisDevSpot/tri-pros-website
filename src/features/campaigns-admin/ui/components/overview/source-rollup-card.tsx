'use client'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'
import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useQueryState } from 'nuqs'

import { campaignTabParser } from '@/features/campaigns-admin/constants/query-parsers'
import { EnrollAllPopover } from '@/features/campaigns-admin/ui/components/overview/enroll-all-popover'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

export function SourceRollupCard({ campaigns, summary }: { campaigns: VoipCampaign[], summary: SourceSummary }) {
  const [, setTab] = useQueryState('tab', campaignTabParser)

  const stats = [
    { accent: 'text-success', label: 'Enrolled', value: summary.enrolledCount },
    { accent: 'text-foreground', label: 'Eligible', value: summary.eligibleCount },
    { accent: 'text-destructive', label: 'DNC', value: summary.dncCount },
  ]

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">{summary.name}</span>
          <span className="truncate text-xs text-muted-foreground">{summary.sourceSlug}</span>
        </div>
        {summary.defaultCampaignId
          ? <Badge className="shrink-0" variant="secondary">Default set</Badge>
          : (
              <Badge
                className="shrink-0 border-warning/40 bg-warning/10 text-warning"
                variant="outline"
              >
                No default
              </Badge>
            )}
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
            <span className={cn('text-lg font-semibold tabular-nums', s.value > 0 ? s.accent : 'text-muted-foreground')}>
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {summary.needsBinding && (
        <p className="text-xs text-muted-foreground">
          Pick a campaign on enroll, or
          {' '}
          <button
            className="-mx-1 inline-flex min-h-6 items-center rounded px-1 font-medium text-warning underline-offset-2 outline-2 outline-primary -outline-offset-2 hover:underline focus-visible:outline"
            type="button"
            onClick={() => setTab('setup')}
          >
            set a default → Setup
          </button>
        </p>
      )}

      <div className="mt-auto pt-1">
        <EnrollAllPopover
          campaigns={campaigns}
          defaultCampaignId={summary.defaultCampaignId}
          eligibleCount={summary.eligibleCount}
          sourceSlug={summary.sourceSlug}
        />
      </div>
    </Card>
  )
}

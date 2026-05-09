'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'
import type { FunnelCounts } from '@/features/lead-sources-admin/lib/compute-funnel-rates'

import { InboxIcon } from 'lucide-react'

import { computeFunnelRates } from '@/features/lead-sources-admin/lib/compute-funnel-rates'
import { formatTimeRangeClause } from '@/features/lead-sources-admin/lib/format-time-range-clause'
import { EmptyState } from '@/shared/components/states/empty-state'
import { formatAsCount } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  funnel: FunnelCounts
  chip: TimeRangeChip
}

export function LeadSourceFunnel({ funnel, chip }: Props) {
  if (funnel.leads === 0) {
    return (
      <EmptyState
        title="No leads in this range"
        description="Try a longer time range, or check the Customers tab."
      >
        <InboxIcon size={48} className="text-muted-foreground/50" />
      </EmptyState>
    )
  }

  const rates = computeFunnelRates(funnel)
  const steps = [
    { label: 'Leads', count: funnel.leads, dropToNext: rates.meetingsRate },
    { label: 'Meetings booked', count: funnel.meetingsBooked, dropToNext: rates.proposalsRate },
    { label: 'Proposals sent', count: funnel.proposalsSent, dropToNext: rates.signedRate },
    { label: 'Signed', count: funnel.signed, dropToNext: null },
  ]

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        {`Funnel · ${formatTimeRangeClause(chip)}`}
      </h3>
      <div className="space-y-1">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const widthPct = (step.count / funnel.leads) * 100
          return (
            <div key={step.label}>
              <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
                <span className="text-sm font-medium">{step.label}</span>
                <div className="h-8 rounded-md bg-muted/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-md transition-[width]', isLast ? 'bg-foreground' : 'bg-foreground/10')}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-right text-sm tabular-nums">{formatAsCount(step.count)}</span>
              </div>
              {step.dropToNext != null && (
                <div className="text-right text-[11px] text-muted-foreground tabular-nums pr-[3rem]">
                  {`−${Math.round((1 - step.dropToNext) * 100)}%`}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

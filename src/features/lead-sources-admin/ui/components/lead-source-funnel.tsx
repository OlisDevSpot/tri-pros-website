'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'
import type { FunnelCounts } from '@/features/lead-sources-admin/lib/compute-funnel-rates'

import { computeFunnelRates } from '@/features/lead-sources-admin/lib/compute-funnel-rates'
import { formatTimeRangeClause } from '@/features/lead-sources-admin/lib/format-time-range-clause'
import { formatAsCount } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  funnel: FunnelCounts
  chip: TimeRangeChip
}

export function LeadSourceFunnel({ funnel, chip }: Props) {
  const rates = computeFunnelRates(funnel)
  const steps = [
    { label: 'Leads', count: funnel.leads, dropFromPrior: null },
    { label: 'Meetings', count: funnel.meetingsBooked, dropFromPrior: rates.meetingsRate },
    { label: 'Proposals', count: funnel.proposalsSent, dropFromPrior: rates.proposalsRate },
    { label: 'Signed', count: funnel.signed, dropFromPrior: rates.signedRate },
  ]

  return (
    <section aria-label="Funnel">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {`Funnel · ${formatTimeRangeClause(chip)}`}
      </h3>
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const widthPct = funnel.leads > 0 ? (step.count / funnel.leads) * 100 : 0
          const dropLabel = step.dropFromPrior == null
            ? null
            : `−${Math.round((1 - step.dropFromPrior) * 100)}%`
          return (
            <div
              key={step.label}
              className="grid grid-cols-[6rem_1fr_3rem_3rem] items-center gap-3 text-xs tabular-nums"
            >
              <span className="font-medium text-foreground">{step.label}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn('h-full rounded-full transition-[width]', isLast ? 'bg-foreground' : 'bg-foreground/30')}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="text-right text-foreground">{formatAsCount(step.count)}</span>
              <span className="text-right text-muted-foreground">{dropLabel ?? ''}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

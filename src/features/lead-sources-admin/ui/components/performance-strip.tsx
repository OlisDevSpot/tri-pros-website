'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

interface PerformanceStripProps {
  stats: { total: number, range: number, signedProposals: number } | undefined
  chip: TimeRangeChip
  isLoading: boolean
  /** Override the `total` cell's label. Defaults to "All-time leads". */
  totalLabel?: string
}

export function PerformanceStrip({ stats, chip, isLoading, totalLabel }: PerformanceStripProps) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <StatCell
        label={totalLabel ?? 'All-time leads'}
        value={stats?.total}
        loading={isLoading}
      />
      <StatCell
        label={chip.kind === 'all' ? 'Leads (all time)' : `Leads · ${chip.label}`}
        value={stats?.range}
        loading={isLoading}
        emphasis
      />
      <StatCell
        label="Signed proposals"
        value={stats?.signedProposals}
        loading={isLoading}
      />
    </div>
  )
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

interface StatCellProps {
  label: string
  value: number | undefined
  loading: boolean
  /** Emphasis: larger number weight. Used for the "focus" stat of the strip. */
  emphasis?: boolean
}

function StatCell({ label, value, loading, emphasis }: StatCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {loading
        ? <Skeleton className="h-7 w-16" />
        : (
            <span
              className={cn(
                'tabular-nums text-foreground',
                emphasis ? 'text-2xl font-semibold' : 'text-xl font-semibold',
              )}
            >
              {formatCount(value)}
            </span>
          )}
    </div>
  )
}

function formatCount(n: number | undefined): string {
  if (n == null) {
    return '0'
  }
  return new Intl.NumberFormat('en-US').format(n)
}

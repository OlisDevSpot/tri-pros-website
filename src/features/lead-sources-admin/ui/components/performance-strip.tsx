'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'

import { resolveTimeRange } from '@/features/lead-sources-admin/lib/resolve-time-range'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface PerformanceStripProps {
  leadSourceId: string
  chip: TimeRangeChip
}

export function PerformanceStrip({ leadSourceId, chip }: PerformanceStripProps) {
  const trpc = useTRPC()
  const range = resolveTimeRange(chip)

  const { data, isLoading } = useQuery(
    trpc.leadSourcesRouter.getStats.queryOptions({
      id: leadSourceId,
      from: range.from,
      to: range.to,
    }),
  )

  return (
    <div className="grid grid-cols-3 gap-6">
      <StatCell
        label="All-time leads"
        value={data?.total}
        loading={isLoading}
      />
      <StatCell
        label={chip.kind === 'all' ? 'Leads (all time)' : `Leads · ${chip.label}`}
        value={data?.range}
        loading={isLoading}
        emphasis
      />
      <StatCell
        label="Signed proposals"
        value={data?.signedProposals}
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

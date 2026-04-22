'use client'

import type { TimeRangeKey } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { BASE_TIME_RANGE_CHIPS, DEFAULT_RANGE_KEY } from '@/features/lead-sources-admin/constants/time-ranges'
import { buildChipsWithYears, resolveTimeRange } from '@/features/lead-sources-admin/lib/resolve-time-range'
import { AllCustomersSection } from '@/features/lead-sources-admin/ui/components/all-customers-section'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { TimeRangeChips } from '@/features/lead-sources-admin/ui/components/time-range-chips'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface AllDetailProps {
  sourceCount: number
  onAddCustomer: () => void
}

/**
 * Aggregate pane shown when the "All" pseudo-row is selected. No tabs — the
 * primary job here is (a) glance at total pipeline health across every source
 * and (b) log an ad-hoc manual customer that wasn't tied to a campaign.
 */
export function AllDetail({ sourceCount, onAddCustomer }: AllDetailProps) {
  const trpc = useTRPC()
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>(DEFAULT_RANGE_KEY)

  const yearsQuery = useQuery(
    trpc.leadSourcesRouter.getYearsWithActivity.queryOptions(),
  )

  const chips = useMemo(
    () => buildChipsWithYears(BASE_TIME_RANGE_CHIPS, yearsQuery.data ?? []),
    [yearsQuery.data],
  )
  const activeChip = chips.find(c => c.key === rangeKey) ?? chips[0]!
  // `resolveTimeRange` calls `new Date()` for rolling windows, so a naked
  // call per render produces a ms-different `from`/`to` each tick — which
  // becomes a new tRPC query key → refetch → re-render → new timestamp.
  // Memoise on `activeChip.key` so the range is stable per chip selection.
  const range = useMemo(() => resolveTimeRange(activeChip), [activeChip.key])

  const statsQuery = useQuery(
    trpc.leadSourcesRouter.getAggregateStats.queryOptions({
      from: range.from,
      to: range.to,
    }),
  )

  return (
    <div className="flex flex-col gap-8 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-foreground">All lead sources</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {`Aggregate performance across ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}.`}
          </p>
        </div>
        <Button size="sm" onClick={onAddCustomer} className="gap-1.5">
          <PlusIcon className="size-4" />
          Add customer
        </Button>
      </header>

      <section aria-label="Aggregate performance" className="flex flex-col gap-4 border-t border-border/40 pt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Performance
          </h3>
          <TimeRangeChips chips={chips} value={activeChip.key} onChange={setRangeKey} />
        </div>
        <PerformanceStrip
          stats={statsQuery.data}
          chip={activeChip}
          isLoading={statsQuery.isLoading}
          totalLabel="All-time leads (all sources)"
        />
      </section>

      <section aria-label="All customers" className="border-t border-border/40 pt-6">
        <AllCustomersSection />
      </section>
    </div>
  )
}

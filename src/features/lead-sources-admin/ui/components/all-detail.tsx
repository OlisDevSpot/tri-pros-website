'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'

import { AllCustomersSection } from '@/features/lead-sources-admin/ui/components/all-customers-section'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface AllDetailProps {
  sourceCount: number
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  onAddCustomer: () => void
}

/**
 * Aggregate pane shown when the "All" pseudo-row is selected. Receives the
 * globally-selected time range from the view so the performance strip reacts
 * to the same chip as the left-col stats.
 */
export function AllDetail({ sourceCount, activeChip, range, onAddCustomer }: AllDetailProps) {
  const trpc = useTRPC()

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
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Performance
        </h3>
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

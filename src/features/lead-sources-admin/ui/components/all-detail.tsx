'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
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
  const entrance = useEntranceMotion()

  const statsQuery = useQuery(
    trpc.leadSourcesRouter.getAggregateStats.queryOptions({
      from: range.from,
      to: range.to,
    }),
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-8 p-6">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <motion.p
            {...entrance(0, 6)}
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Lead sources
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            Aggregate
          </motion.p>
          <motion.h2
            {...entrance(0.04, 6)}
            className="truncate text-3xl font-semibold tracking-tight text-foreground"
          >
            All sources
          </motion.h2>
        </div>
        <motion.div {...entrance(0.08, 6)} className="shrink-0">
          <Button size="sm" onClick={onAddCustomer} className="gap-1.5">
            <PlusIcon className="size-4" />
            Add customer
          </Button>
        </motion.div>
      </header>

      <section aria-label="Aggregate performance" className="flex shrink-0 flex-col gap-3 border-t border-border/40 pt-6">
        <PerformanceStrip
          stats={statsQuery.data}
          chip={activeChip}
          isLoading={statsQuery.isLoading}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          Aggregate across
          {' '}
          {sourceCount}
          {' '}
          {sourceCount === 1 ? 'source' : 'sources'}
        </p>
      </section>

      <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col border-t border-border/40 pt-6">
        <AllCustomersSection />
      </section>
    </div>
  )
}

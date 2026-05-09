'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { motion } from 'motion/react'

import { formatTimeRangeClause } from '@/features/lead-sources-admin/lib/format-time-range-clause'
import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatAsCount, formatAsDollars } from '@/shared/lib/formatters'

interface LeadSourcePerformanceStripProps {
  stats: { total: number, range: number, signedCustomers: number, totalSales: number } | undefined
  chip: TimeRangeChip
  isLoading: boolean
}

export function LeadSourcePerformanceStrip({ stats, chip, isLoading }: LeadSourcePerformanceStripProps) {
  const entrance = useEntranceMotion()

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  const { total, range, signedCustomers, totalSales } = stats

  if (total === 0) {
    return (
      <div className="flex flex-col gap-1">
        <motion.p
          {...entrance(0)}
          className="text-3xl font-semibold tracking-tight tabular-nums text-foreground"
        >
          {formatAsDollars(0)}
        </motion.p>
        <motion.p {...entrance(0.08)} className="text-sm text-muted-foreground">
          No leads yet
        </motion.p>
      </div>
    )
  }

  const showRange = chip.kind !== 'all'

  return (
    <div className="flex flex-col gap-1">
      <motion.p
        {...entrance(0)}
        className="text-3xl font-semibold tracking-tight tabular-nums text-foreground"
      >
        {formatAsDollars(totalSales)}
      </motion.p>
      <motion.p {...entrance(0.08)} className="text-sm text-muted-foreground">
        <span className="tabular-nums">{formatAsCount(signedCustomers)}</span>
        {' '}
        of
        {' '}
        <span className="tabular-nums">{formatAsCount(total)}</span>
        {' '}
        signed
        {showRange && (
          <>
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            <span className="tabular-nums">{formatAsCount(range)}</span>
            {' '}
            {formatTimeRangeClause(chip)}
          </>
        )}
      </motion.p>
    </div>
  )
}

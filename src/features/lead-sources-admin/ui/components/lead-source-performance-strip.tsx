'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatAsDollars } from '@/shared/lib/formatters'

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
        <span className="tabular-nums">{formatCount(signedCustomers)}</span>
        {' '}
        of
        {' '}
        <span className="tabular-nums">{formatCount(total)}</span>
        {' '}
        signed
        {showRange && (
          <>
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            <span className="tabular-nums">{formatCount(range)}</span>
            {' '}
            {renderRangeClause(chip)}
          </>
        )}
      </motion.p>
    </div>
  )
}

function renderRangeClause(chip: TimeRangeChip): string {
  if (chip.key === 'this-month') {
    return 'this month'
  }
  if (chip.kind === 'rolling' && chip.days != null) {
    return `in the last ${chip.days} days`
  }
  if (chip.kind === 'year' && chip.year != null) {
    return `in ${chip.year}`
  }
  return chip.label
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

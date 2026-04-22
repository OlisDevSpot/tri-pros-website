'use client'

import type { ReactNode } from 'react'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Skeleton } from '@/shared/components/ui/skeleton'

interface PerformanceStripProps {
  stats: { total: number, range: number, signedProposals: number } | undefined
  chip: TimeRangeChip
  isLoading: boolean
}

export function PerformanceStrip({ stats, chip, isLoading }: PerformanceStripProps) {
  const entrance = useEntranceMotion()

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-28" />
      </div>
    )
  }

  const { total, range, signedProposals } = stats

  if (total === 0) {
    return (
      <motion.p {...entrance(0)} className="text-sm text-muted-foreground">
        No leads yet
      </motion.p>
    )
  }

  const conversionRate = Math.round((signedProposals / total) * 100)
  const showRange = chip.kind !== 'all'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1">
        <motion.p {...entrance(0)} className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {formatCount(signedProposals)}
          </span>
          <span className="text-base text-muted-foreground">
            of
            {' '}
            <span className="tabular-nums">{formatCount(total)}</span>
            {' '}
            signed
          </span>
        </motion.p>
        <motion.p
          {...entrance(0.08)}
          className="whitespace-nowrap text-xs text-muted-foreground tabular-nums"
        >
          {conversionRate}
          % conversion rate
        </motion.p>
      </div>

      {showRange && (
        <motion.p {...entrance(0.14)} className="text-sm text-muted-foreground">
          {renderRangePhrase(chip, range)}
        </motion.p>
      )}
    </div>
  )
}

function renderRangePhrase(chip: TimeRangeChip, count: number): ReactNode {
  const value = (
    <span className="text-base font-medium text-foreground tabular-nums">
      {formatCount(count)}
    </span>
  )

  if (chip.key === 'this-month') {
    return (
      <>
        {value}
        {' '}
        this month
      </>
    )
  }
  if (chip.kind === 'rolling' && chip.days != null) {
    return (
      <>
        {value}
        {' '}
        in the last
        {' '}
        {chip.days}
        {' '}
        days
      </>
    )
  }
  if (chip.kind === 'year' && chip.year != null) {
    return (
      <>
        {value}
        {' '}
        in
        {' '}
        {chip.year}
      </>
    )
  }
  return (
    <>
      {value}
      <span aria-hidden="true" className="mx-2 opacity-40">·</span>
      {chip.label}
    </>
  )
}

function formatCount(n: number | undefined): string {
  if (n == null) {
    return '0'
  }
  return new Intl.NumberFormat('en-US').format(n)
}

'use client'

import type { ChartTooltipRow } from '@/shared/components/charts/chart-tooltip-rows'

import { ChartTooltipRows } from '@/shared/components/charts/chart-tooltip-rows'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { cn } from '@/shared/lib/utils'

interface Props {
  className: string
  style: React.CSSProperties
  title: string
  rows: ChartTooltipRow[]
}

export function TipSegment({ className, style, title, rows }: Props) {
  return (
    <HybridPopoverTooltip content={<ChartTooltipRows rows={rows} title={title} />}>
      <button aria-label={`${title}: ${rows.map(row => `${row.label} ${row.value}`).join(', ')}`} className={cn('block h-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring', className)} style={style} type="button" />
    </HybridPopoverTooltip>
  )
}

import type { ChartTooltipRow } from '@/shared/components/charts/chart-tooltip-rows'

import { ChartTooltipRows } from '@/shared/components/charts/chart-tooltip-rows'
import { GLASS_SURFACE_STYLE } from '@/shared/constants/glass-surface'

interface Props {
  title: string
  rows: ChartTooltipRow[]
}

export function ChartTooltipCard({ title, rows }: Props) {
  return (
    <div className="rounded-md px-3 py-2 text-popover-foreground" style={GLASS_SURFACE_STYLE}>
      <ChartTooltipRows rows={rows} title={title} />
    </div>
  )
}

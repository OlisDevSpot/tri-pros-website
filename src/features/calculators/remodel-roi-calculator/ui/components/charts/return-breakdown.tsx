'use client'

import type { TooltipContentProps } from 'recharts'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection, ReturnWaterfallRow } from '@/features/calculators/remodel-roi-calculator/types'

import { Bar, BarChart, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'

import { RETURN_BREAKDOWN_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { buildReturnWaterfall } from '@/features/calculators/remodel-roi-calculator/lib/build-return-waterfall'
import { formatMoney, signedMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { PinnedChartTooltip } from '@/shared/components/charts/pinned-chart-tooltip'
import { ChartContainer } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function ReturnBreakdown({ projection, lookAhead }: Props) {
  const tooltip = usePinnedChartTooltip()
  const { rows, low, high } = buildReturnWaterfall(projection, lookAhead)
  const content = ({ active, payload }: TooltipContentProps) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const row = item.payload as ReturnWaterfallRow
    return <ChartTooltipCard rows={[{ label: row.detail, value: signedMoney(row.value) }, ...(row.kind === 'total' ? [] : [{ label: 'Running total', value: formatMoney(row.to) }])]} title={row.label} />
  }
  return (
    <div className="grid gap-1">
      <p className="text-sm font-bold">
        Where the return comes from, by year
        {' '}
        {lookAhead}
      </p>
      <ChartContainer aria-label={`Where the return comes from by year ${lookAhead}: ${rows.map(row => `${row.label}, ${row.detail}, ${signedMoney(row.value)}${row.kind === 'total' ? '' : `, running total ${formatMoney(row.to)}`}`).join('; ')}`} className="aspect-auto w-full" config={RETURN_BREAKDOWN_CHART_CONFIG} debounce={150} role="img" style={{ height: rows.length * 34 + 16 }} {...tooltip.containerProps}>
        <BarChart accessibilityLayer={false} barCategoryGap={8} data={rows} layout="vertical" margin={{ top: 4, right: 96, left: 0, bottom: 4 }}>
          <XAxis domain={[low, high]} hide type="number" />
          <YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={152} />
          <ReferenceLine stroke="var(--muted-foreground)" x={0} />
          <PinnedChartTooltip content={content} cursor={false} pin={tooltip.pin} shared={false} />
          <Bar activeBar dataKey="range" shape={props => <SegmentRect {...props} fill={`var(--color-${(props.payload as ReturnWaterfallRow).kind})`} />}>
            <LabelList className="fill-foreground text-sm font-semibold tabular-nums" dataKey="value" formatter={value => signedMoney(Number(value))} position="right" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

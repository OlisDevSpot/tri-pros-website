'use client'

import type { TooltipContentProps } from 'recharts'

import type { CostOfWaitingRow, CostOfWaitingTrade } from '@/features/calculators/remodel-roi-calculator/types'

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'

import { COST_OF_WAITING_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { PinnedChartTooltip } from '@/shared/components/charts/pinned-chart-tooltip'
import { ChartContainer } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  trade: CostOfWaitingTrade
  growth: number
  max: number
}

export function CostOfWaitingRows({ trade, growth, max }: Props) {
  const tooltip = usePinnedChartTooltip()
  const { label, likeForLikePrice, rows } = trade
  const content = ({ active, payload }: TooltipContentProps) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const row = item.payload as CostOfWaitingRow
    if (item.dataKey === 'today') {
      return <ChartTooltipCard rows={[{ label: 'Same kind, installed today', value: formatMoney(row.today) }]} title={`${label} · today`} />
    }
    if (item.dataKey === 'repairs') {
      return <ChartTooltipCard rows={[{ label: `Repairs, years 1–${row.year}`, value: formatMoney(row.repairs) }]} title={`${label} · repairs`} />
    }
    return <ChartTooltipCard rows={[{ label: 'Price when it gives out', value: formatMoney(row.price) }, { label: `${formatMoney(likeForLikePrice)} × ${(growth ** row.year).toFixed(3)}`, value: '' }]} title={`${label} · year ${row.year}`} />
  }
  return (
    <ChartContainer aria-label={`${label}: ${rows.map(row => `${row.name} ${formatMoney(row.total)}`).join(', ')}`} className="aspect-auto w-full" config={COST_OF_WAITING_CHART_CONFIG} debounce={150} role="img" style={{ height: rows.length * 34 + 8 }} {...tooltip.containerProps}>
      <BarChart barCategoryGap={6} data={rows} layout="vertical" margin={{ top: 4, right: 88, left: 0, bottom: 4 }}>
        <XAxis domain={[0, max || 1]} hide type="number" />
        <YAxis axisLine={false} dataKey="name" tickLine={false} type="category" width={64} />
        <PinnedChartTooltip content={content} cursor={false} pin={tooltip.pin} shared={false} />
        <Bar activeBar dataKey="today" shape={props => <SegmentRect {...props} fill="var(--color-today)" />} stackId="row" />
        <Bar activeBar dataKey="price" shape={props => <SegmentRect {...props} fill="var(--color-price)" />} stackId="row" />
        <Bar activeBar dataKey="repairs" shape={props => <SegmentRect {...props} fill="var(--color-repairs)" />} stackId="row">
          <LabelList className="fill-foreground text-base font-semibold tabular-nums" dataKey="total" formatter={value => formatMoney(Number(value))} position="right" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

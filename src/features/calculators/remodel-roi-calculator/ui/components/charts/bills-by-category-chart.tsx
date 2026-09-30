'use client'

import type { TooltipContentProps } from 'recharts'

import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_CHART_CONFIG, BILL_SWATCH_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/bill-colors'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'
import { PinnedChartTooltip } from '@/shared/components/charts/pinned-chart-tooltip'
import { ChartContainer } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function BillsByCategoryChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const tooltip = usePinnedChartTooltip()
  const used = BILL_CATEGORIES.filter(category => projection.cuts[category].bill > 0)
  const data = [1, 5, lookAhead].map((t, index) => ({
    label: index === 0 ? 'Today' : `Year ${t}`,
    total: projection.years[t].billsNow,
    ...projection.years[t].billsNowByCategory,
  }))
  const content = ({ active, payload }: TooltipContentProps) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const category = item.dataKey as BillCategory
    return <ChartTooltipCard rows={[{ label: BILL_CATEGORY_LABELS[category], value: `${formatMoney(Number(item.value))}/mo`, swatch: BILL_SWATCH_CLASSES[category] }]} title={String(item.payload.label)} />
  }

  return (
    <div className="grid gap-1.5">
      <LegendSwatches config={BILL_CHART_CONFIG} keys={used} />
      <ChartContainer aria-label={`Monthly bills today and later, by bill: ${data.map(row => `${row.label} ${formatMoney(row.total)}`).join(', ')}`} className="aspect-auto h-64 w-full" config={BILL_CHART_CONFIG} debounce={150} role="img" {...tooltip.containerProps}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis axisLine={false} dataKey="label" tickLine={false} />
          <YAxis axisLine={false} tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
          <PinnedChartTooltip content={content} cursor={false} pin={tooltip.pin} shared={false} />
          {used.map((category, position) => (
            <Bar
              activeBar
              dataKey={category}
              isAnimationActive={!reduceMotion}
              key={category}
              maxBarSize={96}
              name={BILL_CATEGORY_LABELS[category]}
              shape={props => <SegmentRect {...props} fill={`var(--color-${category})`} />}
              stackId="bills"
            >
              {position === used.length - 1 && <LabelList className="fill-foreground font-sans text-[13px] font-semibold" dataKey="total" formatter={value => formatMoney(Number(value))} position="top" />}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )
}

'use client'

import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_FILL_CLASSES, BILL_SWATCH_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/bill-colors'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function BillsByCategoryChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState<{ category: BillCategory, index: number } | null>(null)
  // A tapped segment stays highlighted while its tooltip is pinned; releasing the pin clears it.
  const tooltip = usePinnedChartTooltip({ onUnpin: () => setActive(null) })
  const used = BILL_CATEGORIES.filter(category => projection.cuts[category].bill > 0)
  const data = [1, 5, lookAhead].map((t, index) => ({
    label: index === 0 ? 'Today' : `Year ${t}`,
    total: projection.years[t].billsNow,
    ...projection.years[t].billsNowByCategory,
  }))

  return (
    <div className="grid gap-1.5">
      <LegendSwatches items={used.map(category => ({ label: BILL_CATEGORY_LABELS[category], swatch: BILL_SWATCH_CLASSES[category] }))} />
      <div aria-label={`Monthly bills today and later, by bill: ${data.map(row => `${row.label} ${formatMoney(row.total)}`).join(', ')}`} className="h-64 w-full" role="img" {...tooltip.containerProps}>
        <ResponsiveContainer debounce={150} height="100%" width="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis axisLine={false} dataKey="label" stroke="var(--muted-foreground)" tickLine={false} />
            <YAxis axisLine={false} stroke="var(--muted-foreground)" tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
            <Tooltip
              active={tooltip.tooltipActive}
              content={({ active: shown, payload }) => {
                const item = payload?.[0]
                if (!shown || !item) {
                  return null
                }
                const category = item.dataKey as BillCategory
                return <ChartTooltipCard rows={[{ label: BILL_CATEGORY_LABELS[category], value: `${formatMoney(Number(item.value))}/mo`, swatch: BILL_SWATCH_CLASSES[category] }]} title={String(item.payload.label)} />
              }}
              cursor={false}
              shared={false}
            />
            {used.map((category, position) => (
              <Bar
                dataKey={category}
                isAnimationActive={!reduceMotion}
                key={category}
                maxBarSize={96}
                name={BILL_CATEGORY_LABELS[category]}
                onMouseEnter={(_, index) => setActive({ category, index })}
                onMouseLeave={() => !tooltip.pinned && setActive(null)}
                shape={<SegmentRect activeIndex={active?.category === category ? active.index : null} anyActive={active != null} className={BILL_FILL_CLASSES[category]} />}
                stackId="bills"
              >
                {position === used.length - 1 && <LabelList className="fill-foreground font-sans text-[13px] font-semibold" dataKey="total" formatter={(value: number) => formatMoney(value)} position="top" />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

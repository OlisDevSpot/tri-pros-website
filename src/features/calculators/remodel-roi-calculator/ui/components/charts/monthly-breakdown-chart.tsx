'use client'

import type { TooltipContentProps } from 'recharts'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_SWATCH_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/bill-colors'
import { MONTHLY_BREAKDOWN_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

type SegmentKey = 'nowBills' | 'nowLoan' | 'waitBills' | 'waitRepairs' | 'waitLoan'

export function MonthlyBreakdownChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const hatchId = useId()
  const tooltip = usePinnedChartTooltip()
  const used = BILL_CATEGORIES.filter(category => projection.cuts[category].bill > 0)
  const data = projection.years.slice(1, lookAhead + 1).map(year => ({
    t: year.t,
    nowBills: year.billsAfter,
    nowLoan: year.projectPayment,
    waitBills: year.billsNow,
    waitRepairs: year.repairsMonthly,
    waitLoan: year.replacementPayments,
  }))
  const segments: { key: SegmentKey, stack: 'now' | 'wait', fill: string }[] = [
    { key: 'nowBills', stack: 'now', fill: 'var(--color-nowBills)' },
    { key: 'nowLoan', stack: 'now', fill: 'var(--color-nowLoan)' },
    { key: 'waitBills', stack: 'wait', fill: 'var(--color-waitBills)' },
    { key: 'waitRepairs', stack: 'wait', fill: `url(#${hatchId})` },
    { key: 'waitLoan', stack: 'wait', fill: 'var(--color-waitLoan)' },
  ]
  const content = ({ active, payload }: TooltipContentProps) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const key = item.dataKey as SegmentKey
    const year = projection.years[Number(item.payload.t)]
    const isNow = key.startsWith('now')
    const byCategory = isNow ? year.billsAfterByCategory : year.billsNowByCategory
    const rows = key === 'nowBills' || key === 'waitBills'
      ? used.map(category => ({ label: BILL_CATEGORY_LABELS[category], value: `${formatMoney(byCategory[category])}/mo`, swatch: BILL_SWATCH_CLASSES[category] }))
      : [{ label: MONTHLY_BREAKDOWN_CHART_CONFIG[key].label, value: `${formatMoney(Number(item.value))}/mo` }]
    return <ChartTooltipCard rows={[...rows, { label: 'Month total', value: formatMoney(isNow ? year.monthlyNow : year.monthlyWait) }]} title={`Year ${year.t} · ${isNow ? STORY_COPY.paths.now : STORY_COPY.paths.wait}`} />
  }

  return (
    <ChartContainer aria-label="Monthly cost by year and what makes it up, upgrade now next to wait and replace" className="aspect-auto h-72 w-full" config={MONTHLY_BREAKDOWN_CHART_CONFIG} debounce={150} role="img" {...tooltip.containerProps}>
      <BarChart barCategoryGap="18%" barGap={3} data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <pattern height="6" id={hatchId} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="6">
            <rect fill="var(--warning)" fillOpacity={0.22} height="6" width="6" />
            <line stroke="var(--warning)" strokeWidth="2" x1="0" x2="0" y1="0" y2="6" />
          </pattern>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis axisLine={false} dataKey="t" tickFormatter={t => `Yr ${t}`} tickLine={false} />
        <YAxis axisLine={false} tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
        <ChartTooltip active={tooltip.tooltipActive} content={content} cursor={false} shared={false} />
        {segments.map(segment => (
          <Bar
            activeBar
            dataKey={segment.key}
            isAnimationActive={!reduceMotion}
            key={segment.key}
            maxBarSize={30}
            name={MONTHLY_BREAKDOWN_CHART_CONFIG[segment.key].label}
            shape={props => <SegmentRect {...props} fill={segment.fill} />}
            stackId={segment.stack}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

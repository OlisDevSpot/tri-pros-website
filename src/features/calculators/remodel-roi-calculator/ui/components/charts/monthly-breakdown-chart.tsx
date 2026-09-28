'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_SWATCH_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/bill-colors'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

type SegmentKey = 'nowBills' | 'nowLoan' | 'waitBills' | 'waitRepairs' | 'waitLoan'

export function MonthlyBreakdownChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const hatchId = useId()
  const [active, setActive] = useState<{ key: SegmentKey, index: number } | null>(null)
  // A tapped segment stays highlighted while its tooltip is pinned; releasing the pin clears it.
  const tooltip = usePinnedChartTooltip({ onUnpin: () => setActive(null) })
  const used = BILL_CATEGORIES.filter(category => projection.cuts[category].bill > 0)
  const data = projection.years.slice(1, lookAhead + 1).map(year => ({
    t: year.t,
    nowBills: year.billsAfter,
    nowLoan: year.projectPayment,
    waitBills: year.billsNow,
    waitRepairs: year.repairsMonthly,
    waitLoan: year.replacementPayments,
  }))
  const segments: { key: SegmentKey, stack: 'now' | 'wait', label: string, className: string, fill?: string }[] = [
    { key: 'nowBills', stack: 'now', label: 'Bills', className: 'fill-muted-foreground/35' },
    { key: 'nowLoan', stack: 'now', label: 'Project loan', className: 'fill-primary' },
    { key: 'waitBills', stack: 'wait', label: 'Bills', className: 'fill-muted-foreground/35' },
    { key: 'waitRepairs', stack: 'wait', label: 'Repairs', className: '', fill: `url(#${hatchId})` },
    { key: 'waitLoan', stack: 'wait', label: 'Replacement loans', className: 'fill-warning' },
  ]

  return (
    <div aria-label="Monthly cost by year and what makes it up, upgrade now next to wait and replace" className="h-72 w-full" role="img" {...tooltip.containerProps}>
      <ResponsiveContainer debounce={150} height="100%" width="100%">
        <BarChart barCategoryGap="18%" barGap={3} data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <pattern height="6" id={hatchId} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="6">
              <rect fill="var(--warning)" fillOpacity={0.22} height="6" width="6" />
              <line stroke="var(--warning)" strokeWidth="2" x1="0" x2="0" y1="0" y2="6" />
            </pattern>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis axisLine={false} dataKey="t" stroke="var(--muted-foreground)" tickFormatter={t => `Yr ${t}`} tickLine={false} />
          <YAxis axisLine={false} stroke="var(--muted-foreground)" tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
          <Tooltip
            active={tooltip.tooltipActive}
            content={({ active: shown, payload }) => {
              const item = payload?.[0]
              if (!shown || !item) {
                return null
              }
              const key = item.dataKey as SegmentKey
              const year = projection.years[Number(item.payload.t)]
              const isNow = key.startsWith('now')
              const byCategory = isNow ? year.billsAfterByCategory : year.billsNowByCategory
              const rows = key === 'nowBills' || key === 'waitBills'
                ? used.map(category => ({ label: BILL_CATEGORY_LABELS[category], value: `${formatMoney(byCategory[category])}/mo`, swatch: BILL_SWATCH_CLASSES[category] }))
                : [{ label: segments.find(segment => segment.key === key)?.label ?? '', value: `${formatMoney(Number(item.value))}/mo` }]
              return <ChartTooltipCard rows={[...rows, { label: 'Month total', value: formatMoney(isNow ? year.monthlyNow : year.monthlyWait) }]} title={`Year ${year.t} · ${isNow ? STORY_COPY.paths.now : STORY_COPY.paths.wait}`} />
            }}
            cursor={false}
            shared={false}
          />
          {segments.map(segment => (
            <Bar
              dataKey={segment.key}
              isAnimationActive={!reduceMotion}
              key={segment.key}
              maxBarSize={30}
              name={segment.label}
              onMouseEnter={(_, index) => setActive({ key: segment.key, index })}
              onMouseLeave={() => !tooltip.pinned && setActive(null)}
              shape={<SegmentRect activeIndex={active?.key === segment.key ? active.index : null} anyActive={active != null} className={segment.className} fill={segment.fill} />}
              stackId={segment.stack}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

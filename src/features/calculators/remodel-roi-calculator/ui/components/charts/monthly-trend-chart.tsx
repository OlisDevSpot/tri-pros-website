'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { CURRENT_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function MonthlyTrendChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const { milestones, replacements, years } = projection
  const data = years.slice(1, lookAhead + 1)
  const from = milestones.costsLessMonthlyYear != null && milestones.costsLessMonthlyYear <= lookAhead ? milestones.costsLessMonthlyYear : null
  const payoff = milestones.payoffYear != null && milestones.payoffYear < lookAhead ? milestones.payoffYear + 1 : null
  const marks = replacements.flatMap(replacement => replacement.installs.filter(install => install.year < lookAhead).map(install => ({ key: `${replacement.trade}-${install.year}`, label: `${CURRENT_LABELS[replacement.trade]} replaced`, t: install.year + 1 })))
  return (
    <div aria-label={`Monthly cost each year. ${STORY_COPY.paths.now} ${formatMoney(data[0].monthlyNow)} in year 1, ${STORY_COPY.paths.wait} ${formatMoney(data[0].monthlyWait)}.${from ? ` Upgrading costs less from year ${from}.` : ''}`} className="h-72 w-full" role="img">
      <ResponsiveContainer debounce={150} height="100%" width="100%">
        <LineChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis axisLine={false} dataKey="t" stroke="var(--muted-foreground)" tickFormatter={t => `Yr ${t}`} tickLine={false} />
          <YAxis axisLine={false} domain={[0, 'auto']} stroke="var(--muted-foreground)" tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
          {from != null && from > 1 && <ReferenceArea fill="var(--warning)" fillOpacity={0.08} ifOverflow="hidden" x1={1} x2={from} />}
          <Tooltip
            content={({ active, label }) => {
              const year = years[Number(label)]
              if (!active || !year) {
                return null
              }
              return (
                <ChartTooltipCard
                  rows={[
                    { label: STORY_COPY.paths.now, value: formatMoney(year.monthlyNow), swatch: 'bg-primary' },
                    { label: `bills ${formatMoney(year.billsAfter)} + loan ${formatMoney(year.projectPayment)}`, value: '' },
                    { label: STORY_COPY.paths.wait, value: formatMoney(year.monthlyWait), swatch: 'bg-warning' },
                    { label: `bills ${formatMoney(year.billsNow)}${year.repairsMonthly ? ` + repairs ${formatMoney(year.repairsMonthly)}` : ''}${year.replacementPayments ? ` + loans ${formatMoney(year.replacementPayments)}` : ''}`, value: '' },
                  ]}
                  title={`Year ${label} · per month`}
                />
              )
            }}
          />
          <Line activeDot={{ r: 4 }} dataKey="monthlyWait" dot={false} isAnimationActive={!reduceMotion} name={STORY_COPY.paths.wait} stroke="var(--warning)" strokeWidth={2.5} type="monotone" />
          <Line activeDot={{ r: 4 }} dataKey="monthlyNow" dot={false} isAnimationActive={!reduceMotion} name={STORY_COPY.paths.now} stroke="var(--primary)" strokeWidth={2.5} type="monotone" />
          {from != null && <ReferenceDot fill="var(--card)" ifOverflow="extendDomain" label={{ value: `Year ${from}: costs less from here`, position: 'bottom', className: 'fill-foreground text-xs font-extrabold' }} r={5} stroke="var(--primary)" strokeWidth={2.5} x={from} y={years[from].monthlyNow} />}
          {marks.map(mark => <ReferenceDot fill="var(--card)" ifOverflow="extendDomain" key={mark.key} label={{ value: mark.label, position: 'top', className: 'fill-foreground text-xs font-extrabold' }} r={5} stroke="var(--warning)" strokeWidth={2.5} x={mark.t} y={years[mark.t].monthlyWait} />)}
          {payoff != null && <ReferenceLine label={{ value: 'Loan paid off', position: 'insideTop', className: 'fill-foreground text-xs font-extrabold' }} stroke="var(--border)" strokeDasharray="3 3" x={payoff} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

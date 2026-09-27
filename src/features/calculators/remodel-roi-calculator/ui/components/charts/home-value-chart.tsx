'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function HomeValueChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const waits = projection.replacements.length > 0
  const data = projection.years.slice(0, lookAhead + 1)
  return (
    <div className="grid gap-1.5">
      <LegendSwatches items={[{ label: STORY_COPY.paths.now, swatch: 'bg-primary' }, ...(waits ? [{ label: STORY_COPY.paths.wait, swatch: 'bg-warning' }] : [])]} />
      <div aria-label={`Value added to the home: ${roundMoney(data[lookAhead].valueNow)} by year ${lookAhead} if you upgrade now.`} className="h-56 w-full" role="img">
        <ResponsiveContainer debounce={150} height="100%" width="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis axisLine={false} dataKey="t" stroke="var(--muted-foreground)" tickFormatter={t => (t === 0 ? 'Now' : `Yr ${t}`)} tickLine={false} />
            <YAxis axisLine={false} domain={[0, 'auto']} stroke="var(--muted-foreground)" tickFormatter={value => roundMoney(Number(value))} tickLine={false} width={72} />
            <Tooltip content={({ active, label }) => {
              const year = projection.years[Number(label)]
              return active && year
                ? <ChartTooltipCard rows={[{ label: STORY_COPY.paths.now, value: formatMoney(year.valueNow), swatch: 'bg-primary' }, ...(waits ? [{ label: STORY_COPY.paths.wait, value: formatMoney(year.valueWait), swatch: 'bg-warning' }] : [])]} title={`Year ${label} · value added`} />
                : null
            }}
            />
            {waits && <Line dataKey="valueWait" dot={false} isAnimationActive={!reduceMotion} stroke="var(--warning)" strokeWidth={2.5} type="stepAfter" />}
            <Line dataKey="valueNow" dot={false} isAnimationActive={!reduceMotion} stroke="var(--primary)" strokeWidth={2.5} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

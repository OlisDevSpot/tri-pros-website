'use client'

import type { TooltipContentProps } from 'recharts'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'

import { PAY_FOR_ITSELF_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { formatMoney, signedMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { PinnedChartTooltip } from '@/shared/components/charts/pinned-chart-tooltip'
import { ChartContainer } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function PayForItselfChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const tooltip = usePinnedChartTooltip()
  const gradientId = useId()
  const data = projection.years.slice(0, lookAhead + 1)
  const values = data.map(year => year.benefit)
  const max = Math.max(...values)
  const min = Math.min(...values)
  // Where zero falls in the fill's 0–1 range, so the color changes exactly at the line.
  const offset = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min)
  const payback = projection.milestones.paysForItselfYear
  const content = ({ active, label }: TooltipContentProps) => {
    const year = projection.years[Number(label)]
    return active && year
      ? <ChartTooltipCard rows={[{ label: year.benefit >= 0 ? 'Ahead by' : 'Behind by', value: formatMoney(Math.abs(year.benefit)), swatch: year.benefit >= 0 ? 'bg-primary' : 'bg-warning' }]} title={`Year ${label}`} />
      : null
  }
  return (
    <ChartContainer aria-label={`Where upgrading leaves you compared with waiting: ${signedMoney(values[lookAhead])} by year ${lookAhead}.${payback ? ` It pays for itself in year ${payback}.` : ''}`} className="aspect-auto h-60 w-full" config={PAY_FOR_ITSELF_CHART_CONFIG} debounce={150} role="img" {...tooltip.containerProps}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset={offset} stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset={offset} stopColor="var(--warning)" stopOpacity={0.18} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis axisLine={false} dataKey="t" tickFormatter={t => (t === 0 ? 'Now' : `Yr ${t}`)} tickLine={false} />
        <YAxis axisLine={false} tickFormatter={value => signedMoney(Number(value))} tickLine={false} width={92} />
        <ReferenceLine stroke="var(--muted-foreground)" y={0} />
        <PinnedChartTooltip content={content} pin={tooltip.pin} />
        <Area dataKey="benefit" fill={`url(#${gradientId})`} isAnimationActive={!reduceMotion} stroke="var(--color-benefit)" strokeWidth={2.5} type="monotone" />
        {payback != null && payback <= lookAhead && <ReferenceDot fill="var(--card)" label={{ value: `Pays for itself · year ${payback}`, position: 'right', className: 'fill-foreground text-xs font-semibold' }} r={5} stroke="var(--primary)" strokeWidth={2.5} x={payback} y={projection.years[payback].benefit} />}
      </AreaChart>
    </ChartContainer>
  )
}

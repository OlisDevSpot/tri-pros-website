'use client'

import type { BarShapeProps } from 'recharts'

import { useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

import { LOOK_AHEAD } from '@/features/trade-scenes/constants/look-ahead'
import { TWO_FUTURES_CHART, TWO_FUTURES_CHART_CONFIG } from '@/features/trade-scenes/constants/two-futures-chart'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { futureYear } from '@/features/trade-scenes/lib/future-year'
import { FutureBarRect } from '@/features/trade-scenes/ui/components/benefits/future-bar-rect'
import { ChartContainer } from '@/shared/components/ui/chart'

interface TwoFuturesChartProps {
  portrait: boolean
}

// Held outside the render: a fresh margin, domain or shape on a year step would hand recharts new props.
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }
const DOMAIN: [number, (max: number) => number] = [0, max => max * TWO_FUTURES_CHART.headroom]
const WITHOUT_SHAPE = (props: BarShapeProps) => <FutureBarRect {...props} payload={props.payload} series="without" />
const WITH_SHAPE = (props: BarShapeProps) => <FutureBarRect {...props} payload={props.payload} series="with" />

// The picked year lights through the shapes, so the data depends on the figures alone and holds across a year step.
export function TwoFuturesChart({ portrait }: TwoFuturesChartProps) {
  const { today, after, empty } = useBenefitsFigures()
  const reduceMotion = useReducedMotion()
  const data = useMemo(() => Array.from({ length: LOOK_AHEAD.max }, (_, index) => {
    const year = futureYear(today, after, index + 1)
    return { year: year.year, without: year.without.total, with: year.with.total }
  }), [today, after])

  return (
    <ChartContainer aria-hidden config={TWO_FUTURES_CHART_CONFIG} className="aspect-auto size-full border-b border-border-strong">
      <BarChart
        data={data}
        margin={MARGIN}
        barGap={TWO_FUTURES_CHART.barGap}
        barSize={portrait ? TWO_FUTURES_CHART.barSize.portrait : TWO_FUTURES_CHART.barSize.wide}
        accessibilityLayer={false}
      >
        <XAxis dataKey="year" hide />
        <YAxis domain={DOMAIN} hide />
        <Bar dataKey="without" isAnimationActive={!reduceMotion} shape={WITHOUT_SHAPE} />
        {/* With nothing picked the build has no future of its own to draw; picks change only while Benefits is shut. */}
        {!empty && <Bar dataKey="with" isAnimationActive={!reduceMotion} shape={WITH_SHAPE} />}
      </BarChart>
    </ChartContainer>
  )
}

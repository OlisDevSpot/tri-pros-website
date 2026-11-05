'use client'

import type { BarShapeProps } from 'recharts'

import { useReducedMotion } from 'motion/react'

import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { TWO_FUTURES_CHART } from '@/features/trade-scenes/constants/two-futures-chart'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'

interface FutureBarRectProps extends BarShapeProps {
  series: 'without' | 'with'
  payload: { year: number, without: number, with: number }
}

// Passed as a <Bar> shape: the picked year is read here, not handed down as chart data, so a year step changes no data
// and recharts neither replays its animation nor remounts a column.
export function FutureBarRect({ series, payload, x, y, width, height, parentViewBox }: FutureBarRectProps) {
  const { lookAhead } = useBenefits()
  const reduceMotion = useReducedMotion()
  const { barGap, barRadius, bracket, opacity } = TWO_FUTURES_CHART
  const lit = payload.year === lookAhead
  const transition = reduceMotion ? 'none' : `opacity 200ms ${CONTROLS_EASE_CSS}`
  // The bracket spans the pair's gap: from the top of Without down to the top of With, on the pair's right, or on its left
  // where the plot's edge would clip it (the last year on the phone).
  const withTop = payload.without > 0 ? y + height - height * (payload.with / payload.without) : y + height
  const besideWith = x + 2 * width + barGap + width * bracket.gapShare
  const flip = besideWith + bracket.width + bracket.stroke > parentViewBox.x + parentViewBox.width
  const inner = flip ? x - width * bracket.gapShare : besideWith
  const outer = flip ? inner - bracket.width : inner + bracket.width
  const radius = Math.min(bracket.radius, (withTop - y) / 2)
  const turn = flip ? outer + radius : outer - radius

  return (
    <g
      data-future-bar={series}
      data-year={payload.year}
      data-lit={lit || undefined}
      style={{ opacity: lit ? opacity.lit : payload.year === 1 ? opacity.now : opacity.rest, transition }}
    >
      {/* Taller than the column by its radius: the plot's edge clips the lower corners, so only the top ones round. */}
      <rect x={x} y={y} width={width} height={Math.max(0, height) + barRadius} rx={barRadius} fill={`var(--color-${series})`} />
      {series === 'without' && withTop - y > 1 && (
        <path
          data-future-bracket
          d={`M${inner} ${y}H${turn}Q${outer} ${y} ${outer} ${y + radius}V${withTop - radius}Q${outer} ${withTop} ${turn} ${withTop}H${inner}`}
          fill="none"
          strokeWidth={bracket.stroke}
          strokeLinecap="round"
          className="stroke-status-success-fg"
          style={{ opacity: lit ? 1 : 0, transition }}
        />
      )}
    </g>
  )
}

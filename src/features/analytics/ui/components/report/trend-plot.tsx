'use client'

import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'
import type { AnalyticsInterval } from '@/features/analytics/constants/dimensions'
import type { ChartRow } from '@/features/analytics/lib/chart-rows'

import { useLayoutEffect, useRef } from 'react'

import { niceTicks } from '@/features/analytics/lib/chart-rows'
import { TrendAxis } from '@/features/analytics/ui/components/report/trend-axis'
import { TrendBars } from '@/features/analytics/ui/components/report/trend-bars'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

export interface TrendPanel {
  series: readonly ChartSeriesKey[]
  format: 'count' | 'money'
  height: number
}

interface Props {
  rows: ChartRow[]
  interval: AnalyticsInterval
  panels: TrendPanel[]
  /** A double click or double tap on a bucket; absent when there is nothing narrower to zoom to. */
  onBucket?: (row: ChartRow) => void
}

// A bucket never shrinks below this, so its bars and label stay legible; past it the plot scrolls.
const BUCKET_BASE_PX: Record<AnalyticsInterval, number> = { day: 24, week: 40, month: 52 }
const BAR_SLOT_PX = 7
// Two taps on the same bucket within this window zoom in; one tap only shows the tooltip.
const DOUBLE_TAP_MS = 400

export function TrendPlot({ rows, interval, panels, onBucket }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const lastTap = useRef<{ key: string, at: number } | null>(null)
  // One pin across both panels: they share a syncId, so a tap reads counts and dollars together.
  const tooltip = usePinnedChartTooltip()
  const widest = Math.max(...panels.map(p => p.series.length))
  const minWidth = rows.length * (BUCKET_BASE_PX[interval] + BAR_SLOT_PX * widest)
  const scales = panels.map(panel => niceTicks(Math.max(0, ...rows.flatMap(r => panel.series.map(key => r.values[key] ?? 0))), panel.format === 'count', panel.height < 160 ? 2 : 4))

  // The newest bucket is the one people read first, so a scrolling plot opens at its end.
  const firstKey = rows[0]?.key
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) {
      el.scrollLeft = el.scrollWidth
    }
  }, [interval, firstKey, rows.length])

  // Timed by hand: iOS Safari does not fire dblclick on a double tap, and both panels count as one target.
  const tap = onBucket
    ? (row: ChartRow) => {
        const now = performance.now()
        const previous = lastTap.current
        if (previous?.key === row.key && now - previous.at < DOUBLE_TAP_MS) {
          lastTap.current = null
          onBucket(row)
        }
        else {
          lastTap.current = { key: row.key, at: now }
        }
      }
    : undefined

  return (
    <div {...tooltip.containerProps} className="grid grid-cols-[3rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {panels.map((panel, i) => (
          <TrendAxis key={panel.format} ticks={scales[i]} format={panel.format} height={panel.height} />
        ))}
      </div>
      <div ref={scroller} className="overflow-x-auto overscroll-x-contain pb-1">
        <div className="flex flex-col gap-2" style={{ minWidth, width: '100%' }}>
          {panels.map((panel, i) => (
            <TrendBars key={panel.format} rows={rows} interval={interval} series={panel.series} ticks={scales[i]} height={panel.height} pin={tooltip.pin} onBucket={tap} />
          ))}
        </div>
      </div>
    </div>
  )
}

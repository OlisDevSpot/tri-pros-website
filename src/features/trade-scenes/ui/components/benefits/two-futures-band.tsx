'use client'

import type { CSSProperties, PointerEvent } from 'react'

import { LOOK_AHEAD } from '@/features/trade-scenes/constants/look-ahead'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { FutureYearAxis } from '@/features/trade-scenes/ui/components/benefits/future-year-axis'
import { TwoFuturesChartLoader } from '@/features/trade-scenes/ui/components/benefits/two-futures-chart-loader'
import { TwoFuturesReadout } from '@/features/trade-scenes/ui/components/benefits/two-futures-readout'
import { cn } from '@/shared/lib/utils'

interface TwoFuturesBandProps {
  // Behind the open "?", so keys and focus never reach a year the panel covers.
  inert: boolean
}

// The plot and the year axis share ten equal columns, so a press or a drag anywhere along them lands on the year under it,
// the phone's unlabelled ticks included.
export function TwoFuturesBand({ inert }: TwoFuturesBandProps) {
  const { setLookAhead } = useBenefits()
  const { shape } = useSceneVisibleArea()
  const portrait = shape === 'portrait'
  const pickAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setLookAhead(LOOK_AHEAD.min + Math.floor(((event.clientX - box.left) / box.width) * (LOOK_AHEAD.max - LOOK_AHEAD.min + 1)))
  }

  return (
    <section
      data-futures-band
      inert={inert}
      style={{ '--futures-ease': CONTROLS_EASE_CSS } as CSSProperties}
      className={cn('grid shrink-0 gap-2 rounded-[14px] border border-border bg-band', portrait ? 'px-2.5 pt-2 pb-0.5' : 'px-4 pt-3 pb-1')}
    >
      <TwoFuturesReadout portrait={portrait} />
      <div
        data-futures-timeline
        onPointerDown={pickAt}
        onPointerMove={(event) => {
          if (event.buttons !== 0) {
            pickAt(event)
          }
        }}
        className="grid cursor-pointer touch-none gap-0.5 select-none"
      >
        <TwoFuturesChartLoader portrait={portrait} />
        <FutureYearAxis portrait={portrait} />
      </div>
    </section>
  )
}

'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { CLIMATE_LABELS } from '@/shared/modules/construction/core/constants/climate-presets'

// The phone has room for the total only; the breakdown waits in the editor.
export function TodayCostsLine() {
  const { today } = useBenefitsFigures()
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const { shape } = useSceneVisibleArea()

  return (
    <span className={cn('inline-flex min-w-0 items-baseline whitespace-nowrap', shape === 'portrait' ? 'flex-1 gap-1.5' : 'gap-2')}>
      {/* On a 375 px phone the row is too narrow for the whole label: it gives way, never the total. */}
      <span data-costs-label className={cn(CONTROLS_CLASSES.capsLabel, 'tracking-widest', shape === 'portrait' && 'min-w-0 truncate')}>{BENEFITS_COPY.head.todayCosts}</span>
      {shape !== 'portrait' && (
        <span data-costs-parts className="min-w-0 truncate text-xs text-muted-foreground">
          <span data-costs-area className={cn(climate === null && ['font-bold', toneClasses('attention').text])}>
            {climate === null ? BENEFITS_COPY.areaMissing : CLIMATE_LABELS[climate]}
          </span>
          {/* The copy writes the dollar sign; this adds the thousands separator. */}
          {BENEFITS_COPY.head.parts(today.electric.toLocaleString('en-US'), today.gas.toLocaleString('en-US'), today.repairs.toLocaleString('en-US'))}
        </span>
      )}
      <b data-costs-total className="shrink-0 font-bold tabular-nums">
        {/* The display face goes on the figure, not the <b>, so the suffix keeps the body's. */}
        <span className="font-sans text-lg font-semibold">{formatAsDollars(today.total)}</span>
        <small className="text-xs font-bold text-muted-foreground">{SAVINGS_COPY.billSuffix}</small>
      </b>
    </span>
  )
}

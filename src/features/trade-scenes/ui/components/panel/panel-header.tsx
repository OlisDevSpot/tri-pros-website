'use client'

import type { ReactNode } from 'react'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { PANEL_COPY, WEATHER_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface PanelHeaderProps {
  // A control pinned to the heading's right edge, on the eyebrow's line.
  action?: ReactNode
  // The card's size: a smaller title, so the tab's own controls start higher.
  compact?: boolean
}

// Apart from the controls under it, so a resolve re-renders the heading and the controls re-render on their own inputs alone.
export function PanelHeader({ action, compact = false }: PanelHeaderProps) {
  const targets = useSceneTargets()
  const zoom = useSceneInputs((state: TradeSceneInputs) => state.zoom)
  const weather = useSceneInputs((state: TradeSceneInputs) => state.weather)
  const kitWeatherMissing = zoom !== null && targets.assemblies[zoom]?.mode === null
  // The narrow card would wrap the compact title onto a second line and push the tab's controls down with it.
  const narrow = useSceneVisibleArea().shape === 'narrow'
  const compactTitle = narrow ? 'text-lg tracking-[-0.01em]' : 'text-xl tracking-[-0.01em]'

  return (
    <header className="grid gap-y-1.5">
      <div className={cn('grid', compact ? 'gap-1' : 'gap-1.5')}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-[0.2em] text-(--presentation-accent) uppercase">{targets.heading.eyebrow}</p>
          {/* It reaches past the eyebrow's line rather than growing it, so the title below keeps the full width and its place;
              raised, so the part of its 44 px that reaches over the title still takes the tap. */}
          {action && <div className="relative z-10 -my-3.5 shrink-0">{action}</div>}
        </div>
        <h1 className={cn('leading-tight font-semibold text-balance', compact ? compactTitle : 'text-2xl tracking-tight')}>{targets.heading.title}</h1>
      </div>
      <p className="text-sm text-pretty text-muted-foreground">{targets.heading.lead}</p>
      {kitWeatherMissing && <p role="status" className="text-sm text-muted-foreground">{PANEL_COPY.kitWeatherMissing(WEATHER_LABELS[weather])}</p>}
    </header>
  )
}

'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { SCENE_VIEW_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface SystemCardRowProps {
  side: TradeSceneInputs['view']
  children: ReactNode
}

// One side of a card: Today or the Tri Pros build. The side the scene is not showing dims, but its chips still work.
export function SystemCardRow({ side, children }: SystemCardRowProps) {
  const dimmed = useSceneInputs((state: TradeSceneInputs) => state.view !== side)
  return (
    <div data-system-row={side} data-dimmed={dimmed || undefined} className="grid gap-1.5">
      <span className={CONTROLS_CLASSES.capsLabel}>{SCENE_VIEW_LABELS[side]}</span>
      <div
        // The chips take the controls' curve through a variable: a class cannot read the constant.
        style={{ '--chip-ease': CONTROLS_EASE_CSS } as CSSProperties}
        className={cn(
          'flex flex-wrap items-center gap-1.5 *:transition-opacity *:duration-220 *:ease-(--chip-ease) motion-reduce:*:transition-none',
          dimmed && '*:opacity-45 *:hover:opacity-85 *:focus-visible:opacity-85 *:data-[state=open]:opacity-85',
        )}
      >
        {children}
      </div>
    </div>
  )
}

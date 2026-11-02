// LAZY: replaced by the general system view (TS3b.4b).
'use client'

import type { CSSProperties } from 'react'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'

import { PANEL_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useControlsOpen } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { AssemblyScreen } from '@/features/trade-scenes/ui/components/panel/assembly-screen'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

// Left of the scene on wide shapes, down to the band; on portrait it stands on the band, where a window would cover it,
// so it steps away under one and keeps its scroll and peel for when the window closes.
export function CloseUpCard() {
  const zoom = useSceneInputs((state: TradeSceneInputs) => state.zoom)
  const open = useControlsOpen()
  const { shape, stage } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  if (zoom === null) {
    return null
  }
  const { closeUp, controls } = SCENE_LAYOUT
  const portrait = shape === 'portrait'
  const covered = portrait && open !== null
  const placement: CSSProperties = portrait
    ? { left: closeUp.portrait.side, right: closeUp.portrait.side, bottom: controls.modalBottom.portrait, height: Math.round(stage.height * closeUp.portrait.share) }
    : { left: closeUp.gap, top: closeUp.gap, bottom: controls.modalBottom.wide, width: shape === 'narrow' ? closeUp.narrowWidth : closeUp.width }

  return (
    <motion.aside
      data-close-up-card
      aria-label={PANEL_COPY.closeUp}
      inert={covered}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: CONTROLS_EASE }}
      // The frame carries the shadow and the clip inside it the overflow, so the shadow is never clipped. It wears the
      // windows' and the system card's radius and lift, as one more card on the stage.
      style={placement}
      className={cn('absolute z-10 shadow-2xl', portrait ? 'rounded-[20px]' : 'rounded-2xl', covered && 'invisible')}
    >
      {/* A card on the stage's ground, so the fields and controls in it take their rungs from the card's; the scroll
          columns inside bleed by the padding set here. */}
      <div
        style={{ '--panel-padding': `${portrait ? closeUp.portrait.padding : closeUp.padding}px` } as CSSProperties}
        className={cn('flex h-full flex-col overflow-hidden border bg-card px-(--panel-padding)', portrait ? 'rounded-[20px] pt-4' : 'rounded-2xl pt-(--panel-padding)')}
      >
        <AssemblyScreen zoom={zoom} />
      </div>
    </motion.aside>
  )
}

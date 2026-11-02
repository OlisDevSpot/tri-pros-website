'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useReducedMotion } from 'motion/react'

import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

// Frames the stage while it shows the build, so the side shown reads at a glance from anywhere on the scene.
export function ProposedTint() {
  const proposed = useSceneInputs((state: TradeSceneInputs) => state.view === 'proposed')
  const reduceMotion = useReducedMotion()
  return (
    <div
      aria-hidden
      data-proposed-tint
      style={{ opacity: proposed ? 0.55 : 0, transition: reduceMotion ? 'none' : `opacity 250ms ${CONTROLS_EASE_CSS}` }}
      className="pointer-events-none absolute inset-0 inset-ring-3 inset-ring-primary"
    />
  )
}

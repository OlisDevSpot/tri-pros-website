'use client'

import type { ReactNode } from 'react'

import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useState } from 'react'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { useSceneLoad } from '@/features/trade-scenes/contexts/scene-load-context'
import { BRAND_EASE } from '@/shared/constants/motion'

const COLOUR_IN = {
  opacity: [0, 1, 1],
  filter: [
    'saturate(0) brightness(1.25) contrast(0.85)',
    'saturate(0.35) brightness(1.1) contrast(0.95)',
    'saturate(1) brightness(1) contrast(1)',
  ],
}

const SHOWN = { opacity: 1, filter: 'none' }

interface SceneColourInProps {
  children: ReactNode
}

// Live always means shown with no filter, whatever phase the load ended from, so a load cut short by a lost context or the
// watchdog never leaves the scene, or its fallback, behind an invisible layer. The filter goes once the colour-in ends, so
// the live scene never composites through one.
export function SceneColourIn({ children }: SceneColourInProps) {
  const phase = useSceneLoad(state => state.phase)
  const reduced = useReducedMotion() ?? false
  const [colouredIn, setColouredIn] = useState(false)
  const shown = phase === 'live' || colouredIn
  const handover = phase === 'handover' && !colouredIn
  // The motion values themselves, not the DOM: motion repaints from its values on every render, so a value left at 0 by
  // an instant change still waiting for a frame would hide the scene again on the next render. A jump lands at once and
  // stops whatever is running, frames or none.
  const opacity = useMotionValue(0)
  const filter = useMotionValue('none')
  useLayoutEffect(() => {
    if (shown) {
      opacity.jump(1)
      filter.jump('none')
    }
  }, [shown, opacity, filter])

  const animate = shown ? SHOWN : handover ? (reduced ? { opacity: 1 } : COLOUR_IN) : { opacity: 0 }
  const transition = shown
    ? { duration: 0 }
    : reduced
      ? { duration: SCENE_LOAD.reducedFadeMs / 1000, ease: BRAND_EASE }
      : { duration: SCENE_LOAD.colourInMs / 1000, times: [...SCENE_LOAD.colourInTimes], ease: BRAND_EASE }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity, filter }}
      initial={false}
      animate={animate}
      transition={transition}
      onAnimationComplete={() => {
        if (handover) {
          setColouredIn(true)
        }
      }}
    >
      {children}
    </motion.div>
  )
}

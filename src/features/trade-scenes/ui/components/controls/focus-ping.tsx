'use client'

import type { HomeSystemId } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'

interface FocusPingProps {
  framed: HomeSystemId | null
}

// One ring at the middle of what the camera frames, once the glide has brought the system there, so the eye finds it.
// Each newly framed system plays it once; a pick, which never moves the camera, does not. The count of plays is kept on
// the element.
export function FocusPing({ framed }: FocusPingProps) {
  const { area, stage } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const [plays, setPlays] = useState({ system: framed, count: framed === null ? 0 : 1 })
  if (plays.system !== framed) {
    setPlays({ system: framed, count: framed === null ? plays.count : plays.count + 1 })
  }
  const x = area.left + (stage.width - area.left - area.right) / 2
  const y = area.top + (stage.height - area.top - area.bottom) / 2

  return (
    <span data-ping={plays.count} aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {framed !== null && !reduceMotion && (
        <motion.span
          key={plays.count}
          data-ping-ring
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0.9, 0], scale: [0.5, 1.15] }}
          transition={{ duration: 1.1, delay: 0.5, ease: 'easeOut' }}
          style={{ left: x, top: y }}
          className="absolute -mt-15 -ml-15 size-30 rounded-full border-2 border-primary"
        />
      )}
    </span>
  )
}

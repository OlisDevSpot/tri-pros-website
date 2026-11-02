'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'
import { useSceneCamera, useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { tapRingRemainingMs } from '@/shared/components/scene/lib/tap-ring-remaining-ms'

// Drawn in the scene's overlay, which shares the canvas's box, so the mark's canvas-relative pixels place it as they are.
export function TapRing() {
  const tapMark = useSceneCamera(state => state.tapMark)
  const api = useSceneCameraApi()
  const reduceMotion = useReducedMotion()
  // Nothing clears the mark, so a remount (a restored context, a re-hosted overlay) starts with a spent one hidden.
  const [doneAt, setDoneAt] = useState<number | null>(() => {
    const mark = api.getState().tapMark
    return mark && tapRingRemainingMs(mark.at, performance.now()) === 0 ? mark.at : null
  })

  useEffect(() => {
    if (!tapMark) {
      return
    }
    const timer = setTimeout(() => setDoneAt(tapMark.at), tapRingRemainingMs(tapMark.at, performance.now()))
    return () => clearTimeout(timer)
  }, [tapMark])

  if (reduceMotion || !tapMark || doneAt === tapMark.at) {
    return null
  }
  return (
    <motion.div
      key={tapMark.at}
      aria-hidden
      className="pointer-events-none absolute size-11 rounded-full border-2 border-on-media ring-1 ring-scrim/60"
      style={{ left: tapMark.x, top: tapMark.y, x: '-50%', y: '-50%' }}
      initial={{ scale: 0.4, opacity: 1 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: SCENE_GESTURES.tapRingMs / 1000, ease: 'easeOut' }}
    />
  )
}

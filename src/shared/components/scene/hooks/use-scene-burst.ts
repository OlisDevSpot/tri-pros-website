'use client'

import type { SceneBurst } from '@/shared/components/scene/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { burstProgress } from '@/shared/components/scene/lib/burst-progress'

// `running` is state, true from the render that carries a new key until the burst ends (one re-render per burst).
// `progress()` is a live 0 to 1 getter for a caller's own useFrame; reading it during render would be stale.
export function useSceneBurst(key: string): SceneBurst {
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)
  const get = useThree(state => state.get)
  const [prevKey, setPrevKey] = useState(key)
  const [running, setRunning] = useState(!reducedMotion)
  const startedAt = useRef<number | null>(null)
  const finished = useRef(false)

  // While reduced motion is on, key changes are ignored so the scene never wakes; it draws only when its props change.
  if (key !== prevKey) {
    setPrevKey(key)
    if (!reducedMotion) {
      setRunning(true)
    }
  }
  // Reduced motion switched on mid-burst ends that burst, so switching it back off cannot resume one nobody started.
  if (reducedMotion && running) {
    setRunning(false)
  }

  // Before paint, so no frame of the new burst can read the old burst's start and end it at once.
  useLayoutEffect(() => {
    startedAt.current = null
    finished.current = false
    if (!reducedMotion) {
      invalidate()
    }
  }, [key, reducedMotion, invalidate])

  useFrame((state) => {
    if (reducedMotion || !running || finished.current) {
      return
    }
    const now = state.clock.elapsedTime
    startedAt.current ??= now
    if (burstProgress(startedAt.current, now) >= 1) {
      finished.current = true
      setRunning(false)
      return
    }
    state.invalidate()
  })

  const progress = useCallback(() => {
    if (reducedMotion || finished.current) {
      return 1
    }
    return startedAt.current === null ? 0 : burstProgress(startedAt.current, get().clock.elapsedTime)
  }, [reducedMotion, get])

  return { running: running && !reducedMotion, progress }
}

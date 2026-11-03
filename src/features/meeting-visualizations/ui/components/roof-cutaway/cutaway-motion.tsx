'use client'

import type { ReactNode, RefObject } from 'react'
import type { LayerId } from '@/features/meeting-visualizations/types'
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, use, useEffect, useMemo, useRef } from 'react'

interface CutawayMotion {
  /** Damped toward the slider each frame; read in useFrame, never in render. */
  explode: RefObject<number>
  selected: LayerId | null
  reducedMotion: boolean
  onSelect: (id: LayerId) => void
}

const CutawayMotionContext = createContext<CutawayMotion | null>(null)

export function useCutawayMotion(): CutawayMotion {
  const motion = use(CutawayMotionContext)
  if (!motion)
    throw new Error('useCutawayMotion must be used inside <CutawayMotionProvider>')
  return motion
}

const DAMPING = 6
export const SETTLED = 0.0005

export function damp(current: number, target: number, delta: number, reducedMotion: boolean): number {
  if (reducedMotion)
    return target
  // Clamp the step so a backgrounded tab does not snap on return.
  return current + (target - current) * (1 - Math.exp(-DAMPING * Math.min(delta, 0.1)))
}

interface ProviderProps {
  explodeTarget: number
  selected: LayerId | null
  reducedMotion: boolean
  onSelect: (id: LayerId) => void
  children: ReactNode
}

/**
 * The canvas renders on demand to spare the iPad's battery, so every animation here keeps
 * the loop alive by invalidating until it settles, and stops asking once it has.
 */
export function CutawayMotionProvider({ explodeTarget, selected, reducedMotion, onSelect, children }: ProviderProps) {
  const explode = useRef(explodeTarget)
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => invalidate(), [explodeTarget, selected, invalidate])

  useFrame((state, delta) => {
    explode.current = damp(explode.current, explodeTarget, delta, reducedMotion)
    if (Math.abs(explode.current - explodeTarget) > SETTLED)
      state.invalidate()
  })

  const value = useMemo(() => ({ explode, selected, reducedMotion, onSelect }), [selected, reducedMotion, onSelect])
  return <CutawayMotionContext value={value}>{children}</CutawayMotionContext>
}

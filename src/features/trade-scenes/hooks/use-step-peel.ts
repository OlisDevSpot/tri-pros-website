'use client'

import type { SystemLit, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useFrame } from '@react-three/fiber'
import { use, useState } from 'react'

import { LookInsideFadeContext } from '@/features/trade-scenes/contexts/look-inside-fade-context'
import { openPeel } from '@/features/trade-scenes/lib/open-peel'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

// Leaving, the steps close in this many redraws at most, each one a rebuild of the stepped system parts.
const LEAVING_STEPS = 20

// How far the steps stand open. Looking inside they follow the peel at once; leaving, the system is held up close while its
// ghost eases home (`lit` is that held system), and the steps close from where they stood on that same ease, never on one of
// their own, so they are shut the frame the ghost is home. Read by each stepped part itself, so a drag redraws only them.
export function useStepPeel(lit: SystemLit | null): number {
  const fade = use(LookInsideFadeContext)
  if (!fade) {
    throw new Error('useStepPeel must be used inside the HomeKit')
  }
  const looking = useSceneInputs((state: TradeSceneInputs) => state.lookInside)
  const live = useSceneInputs((state: TradeSceneInputs) => lit !== null && state.lookInside ? openPeel(lit.system, state.peel) : 0)
  // Where the steps stood as up close let go, and the share of it the leave still shows.
  const [from, setFrom] = useState(live)
  const [left, setLeft] = useState(1)
  if (looking && (from !== live || left !== 1)) {
    setFrom(live)
    setLeft(1)
  }
  const leaving = !looking && lit !== null
  useFrame(() => {
    const next = Math.round(fade.current * LEAVING_STEPS) / LEAVING_STEPS
    if (leaving && next !== left) {
      setLeft(next)
    }
  })
  return looking ? live : leaving ? from * left : 0
}

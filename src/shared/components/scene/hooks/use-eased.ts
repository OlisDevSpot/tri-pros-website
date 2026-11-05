'use client'

import type { EasedValue } from '@/shared/components/scene/lib/damp-value'

import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { dampValue, easeStepSeconds, isSettled } from '@/shared/components/scene/lib/damp-value'

// The scene renders on demand to spare the iPad's battery, so an easing value asks for frames until it
// settles and then stops asking; at rest the canvas draws nothing.
// `seed` starts each new ease from where the thing actually is, which differs from the last target once the user has moved it.
// `restartKey` joins the target's key, so a new one starts a glide from where the thing is even when the target itself is unchanged.
// The returned `stop` ends the current ease where it is, for a user who takes hold of the thing mid-glide; the next target
// change starts a fresh one.
export function useEased<T extends EasedValue>(target: T, apply: (value: T) => void, seed?: () => T, restartKey?: string | number): () => void {
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)
  const current = useRef<T>(target)
  const latestApply = useRef(apply)
  const latestSeed = useRef(seed)
  const resting = useRef(true)
  const settled = useRef(false)
  useLayoutEffect(() => {
    latestApply.current = apply
    latestSeed.current = seed
  })

  const valueKey = typeof target === 'number' ? String(target) : target.join(',')
  const targetKey = restartKey === undefined ? valueKey : `${valueKey}#${restartKey}`
  const prevKey = useRef(targetKey)
  useEffect(() => {
    // Keyed rather than a first-run flag: StrictMode runs this effect twice on mount, and a mount must open framed, not glide.
    if (latestSeed.current && prevKey.current !== targetKey) {
      current.current = latestSeed.current()
    }
    prevKey.current = targetKey
    resting.current = true
    settled.current = false
    invalidate()
  }, [targetKey, invalidate])

  useFrame((state, delta) => {
    if (settled.current) {
      return
    }
    const next = reducedMotion ? target : dampValue(current.current, target, easeStepSeconds(resting.current, delta))
    resting.current = false
    if (isSettled(next, target)) {
      current.current = target
      latestApply.current(target)
      resting.current = true
      settled.current = true
      return
    }
    current.current = next
    latestApply.current(next)
    state.invalidate()
  })

  return useCallback(() => {
    resting.current = true
    settled.current = true
  }, [])
}

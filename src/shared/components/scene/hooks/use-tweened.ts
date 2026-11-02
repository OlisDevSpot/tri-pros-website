'use client'

import type { EasedValue } from '@/shared/components/scene/lib/damp-value'

import { useFrame, useThree } from '@react-three/fiber'
import { cubicBezier } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { isSettled } from '@/shared/components/scene/lib/damp-value'
import { mixValue } from '@/shared/components/scene/lib/mix-value'

interface Tween {
  duration: number
  ease: readonly [number, number, number, number]
}

// For a value that moves with the DOM, such as the view under a sliding card: `useEased` damps, which trails a bezier
// through the middle and is still landing after it has. This runs the DOM's own curve over the DOM's own time instead,
// asking for frames (the canvas renders on demand) until it lands. A new target mid-way starts a fresh tween from where
// the value is, as motion does; a mount opens on the target.
export function useTweened<T extends EasedValue>(target: T, apply: (value: T) => void, { duration, ease }: Tween): void {
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)
  const [x1, y1, x2, y2] = ease
  const curve = useMemo(() => cubicBezier(x1, y1, x2, y2), [x1, y1, x2, y2])
  const from = useRef<T>(target)
  const current = useRef<T>(target)
  // Taken at the change, not on the first frame: motion's clock starts there too, and a tween started a frame late
  // trails the DOM by that frame all the way.
  const startedAt = useRef(0)
  const running = useRef(true)
  const latestApply = useRef(apply)
  useLayoutEffect(() => {
    latestApply.current = apply
  })

  const targetKey = typeof target === 'number' ? String(target) : target.join(',')
  const prevKey = useRef(targetKey)
  useEffect(() => {
    // Keyed rather than a first-run flag: StrictMode runs this effect twice on mount, and a mount must open framed, not glide.
    if (prevKey.current === targetKey) {
      return
    }
    prevKey.current = targetKey
    from.current = current.current
    startedAt.current = performance.now()
    running.current = true
    invalidate()
  }, [targetKey, invalidate])

  useFrame((state) => {
    if (!running.current) {
      return
    }
    const progress = reducedMotion || isSettled(from.current, target) ? 1 : Math.min((performance.now() - startedAt.current) / (duration * 1000), 1)
    const next = progress === 1 ? target : mixValue(from.current, target, curve(progress))
    current.current = next
    latestApply.current(next)
    if (progress === 1) {
      running.current = false
      return
    }
    state.invalidate()
  })
}

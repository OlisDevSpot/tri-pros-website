'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { useSceneLoad, useSceneLoadApi, useSceneLoadLines } from '@/features/trade-scenes/contexts/scene-load-context'
import { finishDrawIn } from '@/features/trade-scenes/lib/create-scene-load'
import { BRAND_EASE } from '@/shared/constants/motion'

// The wipe is two counter-moving transforms, a box sliding in and its canvas sliding back, never a mask: WebKit keeps only
// transform, opacity and filter on the compositor, and shader linking can hold the main thread through the whole draw-in.
export function BlueprintLines() {
  const store = useSceneLoadApi()
  const lines = useSceneLoadLines()
  const drawing = useSceneLoad(state => state.phase === 'drawing')
  const reduced = useReducedMotion() ?? false
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = box.current
    const canvas = lines.current
    if (!drawing) {
      return
    }
    if (reduced || !element || !canvas) {
      finishDrawIn(store)
      return
    }
    let cancelled = false
    const transition = { duration: SCENE_LOAD.drawMs / 1000, ease: BRAND_EASE }
    const wipe = animate(element, { transform: ['translateX(-100%)', 'translateX(0%)'] }, transition)
    const counter = animate(canvas, { transform: ['translateX(100%)', 'translateX(0%)'] }, transition)
    void Promise.all([wipe, counter]).then(() => {
      if (!cancelled) {
        finishDrawIn(store)
      }
    })
    return () => {
      cancelled = true
      wipe.stop()
      counter.stop()
    }
  }, [drawing, reduced, store, lines])

  // A full-stage bitmap; released as soon as the lines are gone.
  useEffect(() => {
    const canvas = lines.current
    return () => {
      if (canvas) {
        canvas.width = 0
      }
    }
  }, [lines])

  // The copy lands in the same frame the phase turns to drawing, before React can start the wipe, so both start wiped out. The
  // start is a class, not a style: useReducedMotion is null on the server and true on the client's first render, so a style
  // prop would hydrate mismatched and React never repairs an attribute.
  return (
    <div
      ref={box}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [transform:translateX(-100%)] motion-reduce:[transform:none]"
    >
      <canvas ref={lines} className="absolute inset-0 size-full [transform:translateX(100%)] motion-reduce:[transform:none]" />
    </div>
  )
}

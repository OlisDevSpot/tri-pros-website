'use client'

import type { PointerSample } from '@/shared/components/scene/types'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { createTapTracker } from '@/shared/components/scene/lib/create-tap-tracker'

function sampleOf(event: PointerEvent): PointerSample {
  return { pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, time: event.timeStamp, isPrimary: event.isPrimary, button: event.button }
}

// A tap on the scene is a tap away from what floats over it; turning the camera, a pinch or a long press is not, and the
// scene's own tap tracker decides which is which. Presses that start on the controls never reach the canvas's layer.
export function useSceneTapAway(enabled: boolean, onTapAway: () => void): void {
  const { stageElement } = useSceneVisibleArea()
  const [tracker] = useState(() => createTapTracker())
  const latest = useRef(onTapAway)
  useLayoutEffect(() => {
    latest.current = onTapAway
  })

  useEffect(() => {
    if (!enabled || !stageElement) {
      return
    }
    const canvas = stageElement.querySelector<HTMLElement>('[data-scene-canvas]')!
    const doc = canvas.ownerDocument
    const onDown = (event: PointerEvent) => tracker.down(sampleOf(event))
    const onMove = (event: PointerEvent) => tracker.move(sampleOf(event))
    const onUp = (event: PointerEvent) => {
      if (tracker.up(sampleOf(event)) === 'tap') {
        latest.current()
      }
    }
    const onCancel = (event: PointerEvent) => tracker.cancel(event.pointerId)
    // The document hears the moves and the up of a press that leaves the canvas, so a drag released over a card still ends.
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('lostpointercapture', onCancel)
    doc.addEventListener('pointermove', onMove)
    doc.addEventListener('pointerup', onUp)
    doc.addEventListener('pointercancel', onCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('lostpointercapture', onCancel)
      doc.removeEventListener('pointermove', onMove)
      doc.removeEventListener('pointerup', onUp)
      doc.removeEventListener('pointercancel', onCancel)
    }
  }, [enabled, stageElement, tracker])
}

'use client'

import type { PointerSample } from '@/shared/components/scene/types'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { createTapTracker } from '@/shared/components/scene/lib/create-tap-tracker'

function sampleOf(event: PointerEvent): PointerSample {
  return { pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, time: event.timeStamp, isPrimary: event.isPrimary, button: event.button }
}

// A tap on the scene is a tap away from what floats over it; turning the camera, a pinch or a long press is not, and the
// scene's own tap tracker decides which is which. Presses that start on the controls never reach the canvas's layer. A tap
// the house answered itself (a part emphasised, the pins a spot shows) is claimed and leaves what floats over it alone.
export function useSceneTapAway(enabled: boolean, onTapAway: () => void): void {
  const { stageElement } = useSceneVisibleArea()
  const { claimed } = useSceneTapClaim()
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
    // The up only marks the tap: R3F runs a mesh's onClick on the click that follows it, so a house tap's claim is in
    // place only by the time that click reaches the document. A click with no tap marked (a key on a control, a stray
    // click) never puts anything away.
    let tapped = false
    const onDown = (event: PointerEvent) => tracker.down(sampleOf(event))
    const onAnyDown = () => {
      tapped = false
    }
    const onMove = (event: PointerEvent) => tracker.move(sampleOf(event))
    const onUp = (event: PointerEvent) => {
      tapped = tracker.up(sampleOf(event)) === 'tap'
    }
    const onClick = (event: MouseEvent) => {
      const tap = tapped
      tapped = false
      if (tap && canvas.contains(event.target as Node) && !claimed()) {
        latest.current()
      }
    }
    const onCancel = (event: PointerEvent) => {
      tapped = false
      tracker.cancel(event.pointerId)
    }
    // The orbit drag's capture is released on every up, so a lost capture after the up is the tap's own and keeps its mark;
    // one lost mid-press ends the press, and its up marks nothing.
    const onLost = (event: PointerEvent) => tracker.cancel(event.pointerId)
    // The document hears the moves and the up of a press that leaves the canvas, so a drag released over a card still ends.
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('lostpointercapture', onLost)
    doc.addEventListener('pointerdown', onAnyDown)
    doc.addEventListener('pointermove', onMove)
    doc.addEventListener('pointerup', onUp)
    doc.addEventListener('click', onClick)
    doc.addEventListener('pointercancel', onCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('lostpointercapture', onLost)
      doc.removeEventListener('pointerdown', onAnyDown)
      doc.removeEventListener('pointermove', onMove)
      doc.removeEventListener('pointerup', onUp)
      doc.removeEventListener('click', onClick)
      doc.removeEventListener('pointercancel', onCancel)
    }
  }, [enabled, stageElement, tracker, claimed])
}

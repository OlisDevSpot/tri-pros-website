'use client'

import type { PointerSample } from '@/shared/components/scene/types'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { createTapTracker } from '@/shared/components/scene/lib/create-tap-tracker'

interface SceneTapsOptions {
  enabled: boolean
  onMoved: () => void
  onDouble?: (clientX: number, clientY: number) => void
}

function sampleOf(event: PointerEvent): PointerSample {
  return { pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, time: event.timeStamp, isPrimary: event.isPrimary, button: event.button }
}

// Every press re-renders the rig, so the tracker and the listeners must outlive renders or a double-tap's first tap is lost.
export function useSceneTaps({ enabled, onMoved, onDouble }: SceneTapsOptions): void {
  const element = useThree(state => state.events.connected) as HTMLElement | undefined
  const [tracker] = useState(() => createTapTracker())
  const latest = useRef({ onMoved, onDouble })
  useLayoutEffect(() => {
    latest.current = { onMoved, onDouble }
  })

  useEffect(() => {
    if (!enabled || !element) {
      return
    }
    const doc = element.ownerDocument
    const onDown = (event: PointerEvent) => tracker.down(sampleOf(event))
    const onMove = (event: PointerEvent) => {
      if (tracker.move(sampleOf(event)) === 'moved') {
        latest.current.onMoved()
      }
    }
    const onUp = (event: PointerEvent) => {
      if (tracker.up(sampleOf(event)) === 'double') {
        latest.current.onDouble?.(event.clientX, event.clientY)
      }
    }
    // A press the browser takes back (a system gesture, a lost capture) never sends its up; left open it would turn the next tap into a second finger.
    const onCancel = (event: PointerEvent) => tracker.cancel(event.pointerId)
    // The document hears moves and ups that leave the canvas, so a drag released over the card still ends its press.
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('lostpointercapture', onCancel)
    doc.addEventListener('pointermove', onMove)
    doc.addEventListener('pointerup', onUp)
    doc.addEventListener('pointercancel', onCancel)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('lostpointercapture', onCancel)
      doc.removeEventListener('pointermove', onMove)
      doc.removeEventListener('pointerup', onUp)
      doc.removeEventListener('pointercancel', onCancel)
    }
  }, [element, enabled, tracker])
}

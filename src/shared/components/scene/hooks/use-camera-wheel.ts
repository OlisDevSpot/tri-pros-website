'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { createWheelRouter } from '@/shared/components/scene/lib/create-wheel-router'
import { wheelZoomScale } from '@/shared/components/scene/lib/wheel-zoom-scale'

interface CameraWheelOptions {
  enabled: boolean
  // Pixels the content should follow, as a drag would move it.
  panBy: (dxPx: number, dyPx: number) => void
  // What the camera's distance to its target is multiplied by.
  zoomBy: (distanceScale: number) => void
  onMoved: () => void
}

type SafariGestureEvent = Event & { scale: number }

export function useCameraWheel({ enabled, panBy, zoomBy, onMoved }: CameraWheelOptions): void {
  const element = useThree(state => state.events.connected) as HTMLElement | undefined
  const latest = useRef({ panBy, zoomBy, onMoved })
  useLayoutEffect(() => {
    latest.current = { panBy, zoomBy, onMoved }
  })

  useEffect(() => {
    if (!enabled || !element) {
      return
    }
    const router = createWheelRouter({
      now: () => performance.now(),
      schedule: (fn, ms) => {
        const id = setTimeout(fn, ms)
        return () => clearTimeout(id)
      },
      // A wheel delta scrolls the content the other way, so a trackpad swipe carries the house with the fingers.
      onPan: (dx, dy) => latest.current.panBy(-dx, -dy),
      onZoom: deltaY => latest.current.zoomBy(wheelZoomScale(deltaY)),
    })
    let gestureScale: number | null = null

    // Capture phase on the container, ahead of OrbitControls' own bubble listener there, which would zoom on every wheel.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      // macOS Safari may send a pinch both as gesture events and as ctrl-wheel; the gesture already zooms it.
      if (gestureScale !== null && event.ctrlKey) {
        return
      }
      // Every event, not a stream's first: a Recenter inside a stream clears the flag while the stream keeps moving the camera.
      latest.current.onMoved()
      router.wheel({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        timeStamp: event.timeStamp,
      })
    }
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      gestureScale = 1
      latest.current.onMoved()
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const { scale } = event as SafariGestureEvent
      if (gestureScale === null || !(scale > 0)) {
        return
      }
      latest.current.onMoved()
      latest.current.zoomBy(gestureScale / scale)
      gestureScale = scale
    }
    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      gestureScale = null
    }
    // iPadOS reports a Mac user agent and sends gesture events alongside the touch pointers OrbitControls already pinches
    // with, so binding them there would zoom twice; no touch points means a Mac.
    const gestures = 'GestureEvent' in window && navigator.maxTouchPoints === 0

    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    if (gestures) {
      element.addEventListener('gesturestart', onGestureStart)
      element.addEventListener('gesturechange', onGestureChange)
      element.addEventListener('gestureend', onGestureEnd)
    }
    return () => {
      router.dispose()
      element.removeEventListener('wheel', onWheel, { capture: true })
      if (gestures) {
        element.removeEventListener('gesturestart', onGestureStart)
        element.removeEventListener('gesturechange', onGestureChange)
        element.removeEventListener('gestureend', onGestureEnd)
      }
    }
  }, [element, enabled])
}

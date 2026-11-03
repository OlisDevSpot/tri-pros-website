'use client'

import { useFrame } from '@react-three/fiber'
import { use, useRef } from 'react'
import { Vector3 } from 'three'
import { PinRegistryContext } from '@/features/meeting-visualizations/ui/components/roof-cutaway/pin-anchors'

/** Projects every anchor to canvas pixels on each rendered frame and moves its pin there. */
export function PinProjector() {
  const registry = use(PinRegistryContext)
  const world = useRef(new Vector3())

  useFrame(({ camera, size }) => {
    if (!registry)
      return
    for (const [id, anchor] of registry.anchors) {
      const element = registry.elements.get(id)
      if (!element)
        continue
      const point = anchor.getWorldPosition(world.current).project(camera)
      const x = ((point.x + 1) / 2) * size.width
      const y = ((1 - point.y) / 2) * size.height
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      element.setAttribute('data-anchored', '')
    }
  })

  return null
}

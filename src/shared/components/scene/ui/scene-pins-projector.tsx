'use client'

import { useFrame } from '@react-three/fiber'
import { use, useRef } from 'react'
import { Vector3 } from 'three'

import { ScenePinsContext } from '@/shared/components/scene/contexts/scene-pins-context'

export function ScenePinsProjector() {
  const registry = use(ScenePinsContext)
  const world = useRef(new Vector3())

  useFrame(({ camera, size }) => {
    if (!registry) {
      return
    }
    for (const [id, anchor] of registry.anchors) {
      const element = registry.elements.get(id)
      if (!element) {
        continue
      }
      const point = anchor.getWorldPosition(world.current).project(camera)
      // Past the far plane or behind the camera the projection mirrors; hide rather than draw a pin in the wrong place.
      if (point.z > 1) {
        element.removeAttribute('data-anchored')
        continue
      }
      const x = ((point.x + 1) / 2) * size.width
      const y = ((1 - point.y) / 2) * size.height
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      element.setAttribute('data-anchored', '')
    }
  })

  return null
}

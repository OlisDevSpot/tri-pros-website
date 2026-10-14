'use client'

import type { Object3D } from 'three'
import type { LayerId, PinRegistry } from '@/features/meeting-visualizations/types'
import { useFrame } from '@react-three/fiber'
import { createContext, use, useEffect, useRef } from 'react'
import { Vector3 } from 'three'

const PinRegistryContext = createContext<PinRegistry | null>(null)
export const PinRegistryProvider = PinRegistryContext

interface PinAnchorProps {
  id: LayerId
  position: [number, number, number]
}

/** An invisible point that rides with its layer; the DOM overlay draws the pin at its screen position. */
export function PinAnchor({ id, position }: PinAnchorProps) {
  const registry = use(PinRegistryContext)
  const anchor = useRef<Object3D>(null)

  useEffect(() => {
    const node = anchor.current
    if (!registry || !node)
      return
    registry.anchors.set(id, node)
    return () => {
      if (registry.anchors.get(id) === node) {
        registry.anchors.delete(id)
        registry.elements.get(id)?.removeAttribute('data-anchored')
      }
    }
  }, [id, registry])

  return <object3D ref={anchor} position={position} />
}

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

'use client'

import type { Object3D } from 'three'
import type { LayerId, PinRegistry } from '@/features/meeting-visualizations/types'
import { createContext, use, useEffect, useRef } from 'react'

export const PinRegistryContext = createContext<PinRegistry | null>(null)
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

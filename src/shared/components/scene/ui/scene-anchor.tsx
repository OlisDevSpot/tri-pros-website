'use client'

import type { Object3D } from 'three'

import { useThree } from '@react-three/fiber'
import { use, useEffect, useRef } from 'react'

import { ScenePinsContext } from '@/shared/components/scene/contexts/scene-pins-context'

interface SceneAnchorProps {
  id: string
  position: [number, number, number]
}

export function SceneAnchor({ id, position }: SceneAnchorProps) {
  const registry = use(ScenePinsContext)
  const invalidate = useThree(state => state.invalidate)
  const node = useRef<Object3D>(null)

  useEffect(() => {
    const anchor = node.current
    if (!registry || !anchor) {
      return
    }
    registry.register(id, anchor)
    // On demand, a pin that registers after the last frame would sit unplaced until the next input.
    invalidate()
    return () => registry.unregister(id, anchor)
  }, [id, registry, invalidate])

  return <object3D ref={node} position={position} />
}

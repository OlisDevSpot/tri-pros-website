'use client'

import type { BufferGeometry } from 'three'
import { useEffect, useMemo } from 'react'

interface SlabProps {
  size: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  color: string
  roughness?: number
  metalness?: number
}

/** Every layer in the cutaway is a slab of some material; each owns its material so fades stay per-layer. */
export function Slab({ size, position, rotation, color, roughness = 0.85, metalness = 0 }: SlabProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

/** Geometry handed to a mesh through `args` is not disposed by R3F, so the owner disposes it. */
export function useOwnedGeometry<T extends BufferGeometry>(create: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(create, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

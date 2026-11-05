'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'

interface SlabProps {
  size: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  roughness?: number
  metalness?: number
  opacity?: number
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  children?: ReactNode
}

// Each slab owns its material so a fade or a thermal swap stays per part; a child material replaces the default.
export function Slab({ size, position, rotation, color = '#cccccc', roughness = 0.85, metalness = 0, opacity = 1, onClick, children }: SlabProps) {
  return (
    <mesh position={position} rotation={rotation} onClick={onClick}>
      <boxGeometry args={size} />
      {/* three compiles `transparent` into the program, so turning see-through needs a new material, not a prop update. */}
      {children ?? <meshStandardMaterial key={opacity < 1 ? 'see-through' : 'solid'} color={color} roughness={roughness} metalness={metalness} transparent={opacity < 1} opacity={opacity} depthWrite={opacity > 0.5} />}
    </mesh>
  )
}

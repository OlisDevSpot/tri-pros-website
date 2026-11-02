'use client'

import type { FurniturePlacement } from '@/features/trade-scenes/types'

import { RoundedBox } from '@react-three/drei'

interface FurnitureStandInProps {
  placement: FurniturePlacement
}

// The rough shape and colour of the piece, so a model that cannot load leaves the room furnished rather than empty.
export function FurnitureStandIn({ placement }: FurnitureStandInProps) {
  const [width, height, depth] = placement.standIn.size
  const y = placement.hang ? -height / 2 : height / 2
  return (
    <RoundedBox
      args={[width, height, depth]}
      radius={Math.min(0.06, height / 3)}
      position={[placement.position[0], placement.position[1] + y, placement.position[2]]}
      rotation={[0, placement.rotationY, 0]}
      castShadow={placement.castShadow}
    >
      <meshStandardMaterial color={placement.standIn.color} roughness={0.9} />
    </RoundedBox>
  )
}

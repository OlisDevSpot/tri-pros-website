'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'

import { FURNISHING_BOXES, HOME_FURNITURE, LAMP_GLOW_COLOR, ROOM_LAMP_REACH, ROOM_LIGHTS } from '@/features/trade-scenes/constants/home-furnishings'
import { FURNISHING_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { FurniturePiece } from '@/features/trade-scenes/ui/components/home-kit/furniture-piece'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface RoomFurnishingsProps {
  roomLight: number
}

const BUILT = Object.entries(FURNISHING_BOXES) as [keyof typeof FURNISHING_COLORS, readonly BoxSpec[]][]

export function RoomFurnishings({ roomLight }: RoomFurnishingsProps) {
  return (
    <group>
      {HOME_FURNITURE.map(placement => <FurniturePiece key={placement.id} placement={placement} />)}
      {BUILT.map(([colour, boxes]) => (
        <MergedBoxes
          key={colour}
          boxes={boxes}
          color={FURNISHING_COLORS[colour]}
          radius={0.012}
          emissive={colour === 'lampShade' ? LAMP_GLOW_COLOR : undefined}
          emissiveIntensity={colour === 'lampShade' ? roomLight * 0.25 : 0}
        />
      ))}
      {/* Always mounted, dark by day: adding or removing a light recompiles every material in the scene. */}
      {ROOM_LIGHTS.map(position => (
        <pointLight key={position.join(',')} position={[...position]} color={LAMP_GLOW_COLOR} intensity={roomLight} distance={ROOM_LAMP_REACH} decay={2} />
      ))}
    </group>
  )
}

'use client'

import type { ResidentPose } from '@/features/trade-scenes/types'

interface ResidentStandInProps {
  pose: ResidentPose
  color: string
  skin: string
}

// A faceless body and head in the resident's colours, in metres, so a figure that cannot load still leaves someone home.
export function ResidentStandIn({ pose, color, skin }: ResidentStandInProps) {
  const seated = pose === 'seated'
  return (
    <group position={seated ? [0, 0, -0.2] : [0, 0, 0]}>
      <mesh position={[0, seated ? 0.72 : 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.17, seated ? 0.42 : 0.86, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, seated ? 1.22 : 1.6, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
    </group>
  )
}

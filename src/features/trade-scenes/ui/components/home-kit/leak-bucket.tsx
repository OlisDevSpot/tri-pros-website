'use client'

import { DoubleSide } from 'three'

import { LEAK } from '@/features/trade-scenes/constants/home-life'

const { spot: [x, z], floorY, bucket } = LEAK
const HANDLE_RADIUS = bucket.radiusTop * 0.95

// Built in code: a plain pail with water in it, set under the drip.
export function LeakBucket() {
  return (
    <group position={[x, floorY, z]}>
      <mesh position={[0, bucket.height / 2, 0]} castShadow>
        <cylinderGeometry args={[bucket.radiusTop, bucket.radiusBottom, bucket.height, 24, 1, true]} />
        <meshStandardMaterial color={bucket.color} roughness={0.55} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[bucket.radiusBottom, 24]} />
        <meshStandardMaterial color={bucket.color} roughness={0.55} />
      </mesh>
      <mesh position={[0, bucket.height * bucket.waterLine, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[bucket.radiusBottom + (bucket.radiusTop - bucket.radiusBottom) * 0.6 - 0.004, 24]} />
        <meshStandardMaterial color={bucket.water} roughness={0.15} metalness={0.1} />
      </mesh>
      <mesh position={[0, bucket.height, 0]}>
        <torusGeometry args={[HANDLE_RADIUS, 0.006, 6, 24, Math.PI]} />
        <meshStandardMaterial color={bucket.color} roughness={0.5} />
      </mesh>
    </group>
  )
}

'use client'

import type { BufferGeometry, Group } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { ATTIC_FAN_LOOK } from '@/features/trade-scenes/constants/attic-fan-look'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface AtticFanProps {
  running: boolean
  burst: SceneBurst
}

const { radius, depth, blades: bladeCount, box, boxAt, light, turnsPerSecond } = ATTIC_FAN_LOOK
const BLADE_ANGLES = Array.from({ length: bladeCount }, (_, index) => (index / bladeCount) * Math.PI * 2)
const BLADE_LENGTH = radius * 0.9
// Each blade is pitched about its own length, so the order turns it about the hub last.
const BLADE_PITCH = 0.35
// The thermostat's box stands on the same mount as the shroud's front rim, its light on the face toward the attic.
const BOX_Z = depth / 2 - box[2] / 2
const LIGHT_AT = [boxAt[0], boxAt[1] + box[1] * 0.3, depth / 2 - box[2] - light * 0.4] as const

// The blades and the hub turn together and share a paint, so they are one mesh.
function rotorGeometry() {
  const parts: BufferGeometry[] = BLADE_ANGLES.map((angle) => {
    const blade = new BoxGeometry(BLADE_LENGTH, 0.07, 0.008)
    const turn = new Quaternion().setFromEuler(new Euler(BLADE_PITCH, 0, angle, 'ZXY'))
    const at = new Vector3(Math.cos(angle) * BLADE_LENGTH * 0.5, Math.sin(angle) * BLADE_LENGTH * 0.5, 0)
    return blade.applyMatrix4(new Matrix4().compose(at, turn, new Vector3(1, 1, 1)))
  })
  parts.push(new CylinderGeometry(0.04, 0.04, depth * 0.6, 16).rotateX(Math.PI / 2))
  const merged = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return merged
}

// Drawn facing +z, the way it blows. Its blades turn only while the fan thermostat runs it, and its light shows which.
export function AtticFan({ running, burst }: AtticFanProps) {
  const rotor = useRef<Group>(null)
  const blades = useOwnedGeometry(rotorGeometry, [])
  useBurstMotion(burst, (life, seconds) => {
    if (running && rotor.current) {
      rotor.current.rotation.z += seconds * turnsPerSecond * life * Math.PI * 2
    }
  })

  return (
    <group userData={systemPartTag('attic-fan')}>
      {/* Open both ends, so it is seen from either side as a drum. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, depth, 28, 1, true]} />
        <meshStandardMaterial color={HOME_PALETTE.fanShroud} roughness={0.55} metalness={0.3} side={DoubleSide} />
      </mesh>
      <group ref={rotor}>
        <mesh geometry={blades}>
          <meshStandardMaterial color={HOME_PALETTE.fanBlade} roughness={0.6} />
        </mesh>
      </group>
      <mesh position={[boxAt[0], boxAt[1], BOX_Z]}>
        <boxGeometry args={[...box]} />
        <meshStandardMaterial color={HOME_PALETTE.fanBox} roughness={0.7} />
      </mesh>
      {/* Its own paint under the thermal camera, so a running fan's light stays lit. */}
      <group userData={thermalTag(OWN_PAINT)}>
        <mesh position={[...LIGHT_AT]}>
          <sphereGeometry args={[light, 12, 8]} />
          <meshStandardMaterial
            color={running ? HOME_PALETTE.statusLight : HOME_PALETTE.fanBlade}
            emissive={running ? HOME_PALETTE.statusLight : '#000000'}
            emissiveIntensity={running ? 1.6 : 0}
            roughness={0.4}
          />
        </mesh>
      </group>
    </group>
  )
}

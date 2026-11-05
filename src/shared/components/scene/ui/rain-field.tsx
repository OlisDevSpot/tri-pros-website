'use client'

import type { InstancedMesh } from 'three'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D } from 'three'

import { RAIN } from '@/shared/components/scene/constants/rain'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface RainFieldProps {
  box: readonly [number, number, number]
  position?: readonly [number, number, number]
  intensity: number
  running: boolean
}

// Deterministic so a remount draws the same sky.
function seededUnit(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function RainField({ box, position = [0, 0, 0], intensity, running }: RainFieldProps) {
  const [width, height, depth] = box
  const invalidate = useThree(state => state.invalidate)
  const mesh = useRef<InstancedMesh>(null)
  const elapsed = useRef(0)
  const dummy = useMemo(() => new Object3D(), [])
  const streaks = useMemo(() => Array.from({ length: RAIN.maxStreaks }, (_, i) => ({
    x: (seededUnit(i, 1) - 0.5) * width,
    z: (seededUnit(i, 2) - 0.5) * depth,
    phase: seededUnit(i, 3),
    speed: 0.8 + seededUnit(i, 4) * 0.4,
  })), [width, depth])

  const place = () => {
    const instanced = mesh.current
    if (!instanced) {
      return
    }
    streaks.forEach((streak, i) => {
      // Wrapping the fall distance keeps each streak inside the box without respawning anything.
      const travelled = (streak.phase * height + elapsed.current * RAIN.fallSpeed * streak.speed) % height
      dummy.position.set(streak.x, height / 2 - travelled, streak.z)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    })
    instanced.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    place()
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaks, height, invalidate])

  // The parent's burst invalidates while it runs; this makes sure the first moving frame is requested too.
  useEffect(() => {
    if (running) {
      invalidate()
    }
  }, [running, invalidate])

  useEased(intensity, (value) => {
    if (mesh.current) {
      mesh.current.count = Math.round(Math.min(Math.max(value, 0), 1) * RAIN.maxStreaks)
    }
  })

  // Moving streaks need a frame requested every frame; once stopped nothing asks, so the canvas rests.
  useFrame((state, delta) => {
    if (!running) {
      return
    }
    elapsed.current += Math.min(delta, RAIN.maxFrameSeconds)
    place()
    state.invalidate()
  })

  return (
    <group position={position as [number, number, number]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, RAIN.maxStreaks]} frustumCulled={false} raycast={ignoreRaycast}>
        <boxGeometry args={[RAIN.streakWidth, RAIN.streakLength, RAIN.streakWidth]} />
        <meshBasicMaterial color={RAIN.color} transparent opacity={RAIN.opacity} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

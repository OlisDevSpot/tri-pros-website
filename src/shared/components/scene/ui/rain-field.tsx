'use client'

import type { InstancedMesh } from 'three'
import type { RainColumn } from '@/shared/components/scene/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, Vector3 } from 'three'

import { RAIN } from '@/shared/components/scene/constants/rain'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface RainFieldProps {
  columns: readonly RainColumn[]
  running: boolean
}

type Vec3 = readonly [number, number, number]

interface Streak {
  share: number
  start: Vec3
  flow: Vec3
  span: number
  length: number
  phase: number
  speed: number
}

const DOWN: Vec3 = [0, -1, 0]
const STREAK_AXIS = new Vector3(...DOWN)

// Deterministic so a remount draws the same sky.
function seededUnit(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// The count's ease draws the first streaks in this order, so ordering each column's streaks by their share of it, rather
// than one column after another, thins every column alike instead of emptying the last ones.
export function seededStreaks(columns: readonly RainColumn[]): Streak[] {
  const starts = columns.map((_, index) => columns.slice(0, index).reduce((sum, column) => sum + column.streaks, 0))
  return columns.flatMap(({ box, position, streaks, flow = DOWN }, column) => {
    const axis = flow.findIndex(component => component !== 0)
    const span = box[axis]!
    return Array.from({ length: streaks }, (_, index) => {
      const seed = starts[column]! + index
      // Each streak enters at the face its flow leaves behind, scattered across the other two.
      const at = (i: number, salt: number) => position[i]! + (i === axis ? -flow[i]! * span / 2 : (seededUnit(seed, salt) - 0.5) * box[i]!)
      return {
        share: (index + 0.5) / streaks,
        start: [at(0, 1), at(1, 5), at(2, 2)] as const,
        flow,
        span,
        length: Math.min(RAIN.streakLength, span / 2),
        phase: seededUnit(seed, 3),
        // A streak wraps back to where it entered, so one frame carrying it past half a short column lands it behind where
        // it was and the water reads as running backwards; a quarter on the longest frame keeps the way it runs clear.
        speed: Math.min(RAIN.fallSpeed * (0.8 + seededUnit(seed, 4) * 0.4), span / (4 * RAIN.maxFrameSeconds)),
      }
    })
  }).sort((a, b) => a.share - b.share)
}

// Wrapping the distance run keeps each streak inside its column without respawning anything.
export function streakAt({ start, flow, span, phase, speed }: Streak, seconds: number): Vec3 {
  const run = (phase * span + seconds * speed) % span
  return [start[0] + flow[0] * run, start[1] + flow[1] * run, start[2] + flow[2] * run]
}

export function RainField({ columns, running }: RainFieldProps) {
  const invalidate = useThree(state => state.invalidate)
  const mesh = useRef<InstancedMesh>(null)
  const elapsed = useRef(0)
  const dummy = useMemo(() => new Object3D(), [])
  const direction = useMemo(() => new Vector3(), [])
  const total = columns.reduce((sum, column) => sum + column.streaks, 0)
  const streaks = useMemo(() => seededStreaks(columns), [columns])

  const place = () => {
    const instanced = mesh.current
    if (!instanced) {
      return
    }
    streaks.forEach((streak, i) => {
      dummy.position.set(...streakAt(streak, elapsed.current))
      dummy.quaternion.setFromUnitVectors(STREAK_AXIS, direction.set(...streak.flow))
      dummy.scale.set(1, streak.length / RAIN.streakLength, 1)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    })
    instanced.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    place()
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaks, invalidate])

  // The parent's burst invalidates while it runs; this makes sure the first moving frame is requested too.
  useEffect(() => {
    if (running) {
      invalidate()
    }
  }, [running, invalidate])

  useEased(total, (value) => {
    if (mesh.current) {
      mesh.current.count = Math.min(Math.max(Math.round(value), 0), total)
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

  if (total === 0) {
    return null
  }
  return (
    <instancedMesh key={total} ref={mesh} args={[undefined, undefined, total]} frustumCulled={false} raycast={ignoreRaycast}>
      <boxGeometry args={[RAIN.streakWidth, RAIN.streakLength, RAIN.streakWidth]} />
      <meshBasicMaterial color={RAIN.color} transparent opacity={RAIN.opacity} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

'use client'

import type { BoxSpec, GutterRun } from '@/features/trade-scenes/types'

import { gutterGeometry } from '@/features/trade-scenes/ui/lib/gutter-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface GutterRunMeshProps {
  // Callers pass memoized or module-level lists: a new array rebuilds the geometry.
  runs: readonly GutterRun[]
  boxes: readonly BoxSpec[]
  streaks: readonly number[]
  color: string
  streakColor: string
  roughness: number
}

// The colours ride on the vertices under a white material, so the Thermal lens, which swaps the material, paints the whole gutter
// its one temperature and the streaks go with the colours.
export function GutterRunMesh({ runs, boxes, streaks, color, streakColor, roughness }: GutterRunMeshProps) {
  const geometry = useOwnedGeometry(() => gutterGeometry(runs, boxes, streaks, color, streakColor), [runs, boxes, streaks, color, streakColor])
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={roughness} />
    </mesh>
  )
}

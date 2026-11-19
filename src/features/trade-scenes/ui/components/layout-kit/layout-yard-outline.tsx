'use client'

import type { ResolvedLayout, YardId } from '@/features/trade-scenes/types'

import { BufferGeometry, Float32BufferAttribute } from 'three'

import { LAYOUT_EDITOR_LOOK } from '@/features/trade-scenes/constants/layout-editor-look'
import { regionRings } from '@/features/trade-scenes/lib/region-rings'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'
import { yardTileIndices } from '@/features/trade-scenes/lib/yards'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutYardOutlineProps {
  resolved: ResolvedLayout
  yard: YardId
}

// As a region's outline, an edge along z is split at every row so it follows the grade. A dashed line needs each vertex's
// distance along the line, which three computes only on the object, so it is written into the geometry here.
function yardOutlineGeometry({ layout, origin, heightAt, yards }: ResolvedLayout, yard: YardId): BufferGeometry {
  const { originX, frontZ, tile } = origin
  const positions: number[] = []
  const distances: number[] = []
  let run = 0
  const point = (c: number, r: number) => {
    const z = frontZ - metresOf(r, tile)
    return [originX + metresOf(c, tile), heightAt(z) + LAYOUT_EDITOR_LOOK.yardLift, z] as const
  }
  const segment = (from: readonly [number, number], to: readonly [number, number]) => {
    const a = point(...from)
    const b = point(...to)
    positions.push(...a, ...b)
    distances.push(run, run + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
    run = distances[distances.length - 1]
  }
  for (const ring of regionRings(new Set(yardTileIndices(yards, yard)), layout.lot.cols)) {
    ring.forEach(([c0, r0], n) => {
      const [c1, r1] = ring[(n + 1) % ring.length]
      if (r0 === r1) {
        segment([c0, r0], [c1, r1])
        return
      }
      const step = Math.sign(r1 - r0)
      for (let r = r0; r !== r1; r += step) {
        segment([c0, r], [c0, r + step])
      }
    })
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('lineDistance', new Float32BufferAttribute(distances, 1))
  return geometry
}

// The yard Areas holds, outlined on the lot while its card is open.
export function LayoutYardOutline({ resolved, yard }: LayoutYardOutlineProps) {
  const geometry = useOwnedGeometry(() => yardOutlineGeometry(resolved, yard), [resolved, yard])
  return (
    <lineSegments geometry={geometry} raycast={ignoreRaycast}>
      <lineDashedMaterial color={LAYOUT_EDITOR_LOOK.yard} dashSize={LAYOUT_EDITOR_LOOK.yardDash} gapSize={LAYOUT_EDITOR_LOOK.yardGap} depthWrite={false} />
    </lineSegments>
  )
}

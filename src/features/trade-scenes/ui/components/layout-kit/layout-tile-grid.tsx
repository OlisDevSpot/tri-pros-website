'use client'

import type { ResolvedLayout } from '@/features/trade-scenes/types'

import { BufferGeometry, Float32BufferAttribute } from 'three'

import { metresOf } from '@/features/trade-scenes/lib/tile-units'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutTileGridProps {
  resolved: ResolvedLayout
}

const LIFT = 0.01

// The grade is flat across x, so a row line is one segment; a column line bends at every row to stay on the slope.
function tileGridGeometry({ layout, origin, heightAt }: ResolvedLayout): BufferGeometry {
  const { cols, rows } = layout.lot
  const { originX, frontZ, tile } = origin
  const zOf = (r: number) => frontZ - metresOf(r, tile)
  const yOf = (r: number) => heightAt(zOf(r)) + LIFT
  const positions: number[] = []
  for (let c = 0; c <= cols; c++) {
    const x = originX + metresOf(c, tile)
    for (let r = 0; r < rows; r++) {
      positions.push(x, yOf(r), zOf(r), x, yOf(r + 1), zOf(r + 1))
    }
  }
  const x1 = originX + metresOf(cols, tile)
  for (let r = 0; r <= rows; r++) {
    positions.push(originX, yOf(r), zOf(r), x1, yOf(r), zOf(r))
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export function LayoutTileGrid({ resolved }: LayoutTileGridProps) {
  const geometry = useOwnedGeometry(() => tileGridGeometry(resolved), [resolved])
  return (
    <lineSegments geometry={geometry} raycast={ignoreRaycast}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
    </lineSegments>
  )
}

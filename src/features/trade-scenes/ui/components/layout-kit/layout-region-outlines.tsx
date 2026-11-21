'use client'

import type { EditorSelection } from '@/features/trade-scenes/lib/create-layout-editor'
import type { LotRegion, ResolvedLayout } from '@/features/trade-scenes/types'

import { BufferGeometry, Float32BufferAttribute } from 'three'

import { LAYOUT_EDITOR_LOOK } from '@/features/trade-scenes/constants/layout-editor-look'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutRegionOutlinesProps {
  resolved: ResolvedLayout
  selected: EditorSelection | null
}

const LIFT = 0.02
const SELECTED_LIFT = 0.03

// An edge that runs along z is split at every row, so it follows the grade instead of cutting under it.
function outlineGeometry(regions: readonly LotRegion[], { origin, heightAt }: ResolvedLayout, lift: number): BufferGeometry {
  const { originX, frontZ, tile } = origin
  const positions: number[] = []
  const corner = (c: number, r: number) => {
    const z = frontZ - metresOf(r, tile)
    positions.push(originX + metresOf(c, tile), heightAt(z) + lift, z)
  }
  for (const region of regions) {
    for (const ring of region.rings) {
      ring.forEach(([c0, r0], n) => {
        const [c1, r1] = ring[(n + 1) % ring.length]
        if (r0 === r1) {
          corner(c0, r0)
          corner(c1, r1)
          return
        }
        const step = Math.sign(r1 - r0)
        for (let r = r0; r !== r1; r += step) {
          corner(c0, r)
          corner(c0, r + step)
        }
      })
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export function LayoutRegionOutlines({ resolved, selected }: LayoutRegionOutlinesProps) {
  const all = useOwnedGeometry(() => outlineGeometry(resolved.regions, resolved, LIFT), [resolved])
  const chosen = useOwnedGeometry(() => outlineGeometry(resolved.regions.filter(region => selected?.type === 'region' && region.id === selected.id), resolved, SELECTED_LIFT), [resolved, selected])
  return (
    <group>
      <lineSegments geometry={all} raycast={ignoreRaycast}>
        <lineBasicMaterial color={LAYOUT_EDITOR_LOOK.outline} transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={chosen} raycast={ignoreRaycast}>
        <lineBasicMaterial color={LAYOUT_EDITOR_LOOK.selected} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

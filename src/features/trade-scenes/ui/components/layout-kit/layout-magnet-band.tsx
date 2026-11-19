'use client'

import type { ResolvedLayout } from '@/features/trade-scenes/types'

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { LAYOUT_EDITOR_LOOK } from '@/features/trade-scenes/constants/layout-editor-look'
import { MAGNET_TILES } from '@/features/trade-scenes/constants/layout-grid'
import { fenceBandGeometry } from '@/features/trade-scenes/ui/lib/fence-band-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutMagnetBandProps {
  resolved: ResolvedLayout
}

// Lit while a fence is on the bar, so the reach of the lot line shows before the finger lands.
export function LayoutMagnetBand({ resolved }: LayoutMagnetBandProps) {
  const { cols, rows } = resolved.layout.lot
  const geometry = useOwnedGeometry(() => {
    // The across strips run past the corners to cover the squares the magnet reaches there; the along strips stop where
    // the across ones end, so no square is drawn twice.
    const strips = ([
      { axis: 'across', line: 0, from: -MAGNET_TILES, to: cols + MAGNET_TILES },
      { axis: 'across', line: rows, from: -MAGNET_TILES, to: cols + MAGNET_TILES },
      { axis: 'along', line: 0, from: MAGNET_TILES, to: rows - MAGNET_TILES },
      { axis: 'along', line: cols, from: MAGNET_TILES, to: rows - MAGNET_TILES },
    ] as const).map(range => fenceBandGeometry(range, resolved.origin, resolved.heightAt, 2 * MAGNET_TILES * resolved.origin.tile, LAYOUT_EDITOR_LOOK.magnetLift))
    const merged = mergeGeometries(strips)
    strips.forEach(strip => strip.dispose())
    return merged
  }, [resolved, cols, rows])
  return (
    <mesh geometry={geometry} raycast={ignoreRaycast} renderOrder={LAYOUT_EDITOR_LOOK.fenceOverlayOrder}>
      <meshBasicMaterial color={LAYOUT_EDITOR_LOOK.magnet} transparent opacity={LAYOUT_EDITOR_LOOK.magnetOpacity} depthWrite={false} />
    </mesh>
  )
}

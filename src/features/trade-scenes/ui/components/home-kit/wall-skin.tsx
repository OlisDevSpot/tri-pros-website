'use client'

import type { WallSkinSpec } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'

import { wallSkinsGeometry } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface WallSkinProps {
  // Callers pass a module-level list: a new array rebuilds the geometry.
  skins: readonly WallSkinSpec[]
  color: string
  castShadow?: boolean
  receiveShadow?: boolean
}

export function WallSkin({ skins, color, castShadow = false, receiveShadow = false }: WallSkinProps) {
  const geometry = useOwnedGeometry(() => wallSkinsGeometry(skins), [skins])
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

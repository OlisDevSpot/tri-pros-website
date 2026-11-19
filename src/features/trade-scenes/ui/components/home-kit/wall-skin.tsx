'use client'

import type { SurfaceTexture } from '@/features/trade-scenes/types'
import type { WallSkinSpec } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'

import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { wallSkinsGeometry } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface WallSkinProps {
  // Callers pass a module-level list: a new array rebuilds the geometry.
  skins: readonly WallSkinSpec[]
  color: string
  texture?: SurfaceTexture
  castShadow?: boolean
  receiveShadow?: boolean
}

export function WallSkin({ skins, color, texture, castShadow = false, receiveShadow = false }: WallSkinProps) {
  const geometry = useOwnedGeometry(() => wallSkinsGeometry(skins), [skins])
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
      {texture
        ? <TexturedMaterial {...texture} color={color} roughness={0.9} />
        : <meshStandardMaterial color={color} roughness={0.9} />}
    </mesh>
  )
}

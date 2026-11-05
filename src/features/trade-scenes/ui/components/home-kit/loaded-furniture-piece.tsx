'use client'

import type { FurniturePlacement } from '@/features/trade-scenes/types'

import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { FURNITURE_MATTE_ROUGHNESS } from '@/features/trade-scenes/constants/home-furnishings'
import { FurnitureStandIn } from '@/features/trade-scenes/ui/components/home-kit/furniture-stand-in'
import { useGltfAsset } from '@/shared/components/scene/hooks/use-gltf-asset'

interface LoadedFurniturePieceProps {
  placement: FurniturePlacement
}

export function LoadedFurniturePiece({ placement }: LoadedFurniturePieceProps) {
  const asset = useGltfAsset(placement.url)
  const invalidate = useThree(state => state.invalidate)

  // The pack's pivots sit at a corner; centring on the footprint lets a placement name where the piece stands.
  const offset = useMemo(() => {
    if (!asset) {
      return null
    }
    const bounds = new Box3().setFromObject(asset.scene)
    const centre = bounds.getCenter(new Vector3())
    return [-centre.x, placement.hang ? -bounds.max.y : -bounds.min.y, -centre.z] as const
  }, [asset, placement.hang])

  // Matte and recoloured by material name, so the pack sits in the home's light and palette instead of its own bright colours.
  useEffect(() => {
    if (!asset) {
      return
    }
    for (const material of asset.materials) {
      if (material instanceof MeshStandardMaterial) {
        const colour = placement.colors[material.name]
        if (colour) {
          material.color.set(colour)
        }
        material.roughness = FURNITURE_MATTE_ROUGHNESS
        material.metalness = 0
      }
    }
    asset.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = placement.castShadow ?? false
      }
    })
    invalidate()
  }, [asset, placement, invalidate])

  if (!asset || !offset) {
    return <FurnitureStandIn placement={placement} />
  }

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]} scale={placement.scale}>
      <primitive object={asset.scene} position={offset} />
    </group>
  )
}

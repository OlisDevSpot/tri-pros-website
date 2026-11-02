'use client'

import type { FurniturePlacement } from '@/features/trade-scenes/types'

import { FurnitureStandIn } from '@/features/trade-scenes/ui/components/home-kit/furniture-stand-in'
import { LoadedFurniturePiece } from '@/features/trade-scenes/ui/components/home-kit/loaded-furniture-piece'
import { AssetBoundary } from '@/shared/components/scene/ui/asset-boundary'

interface FurniturePieceProps {
  placement: FurniturePlacement
}

export function FurniturePiece({ placement }: FurniturePieceProps) {
  return (
    <AssetBoundary fallback={<FurnitureStandIn placement={placement} />}>
      <LoadedFurniturePiece placement={placement} />
    </AssetBoundary>
  )
}

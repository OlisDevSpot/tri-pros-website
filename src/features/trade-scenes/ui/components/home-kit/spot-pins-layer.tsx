'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { spotPinId } from '@/features/trade-scenes/lib/spot-pin-id'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface SpotPinsLayerProps {
  rides: 'lift' | 'ground'
}

// Up close the system's own parts take the pins, so a tapped spot shows none there.
function selectTapped(state: TradeSceneInputs) {
  return state.lookInside ? null : state.tappedSpot
}

// One anchor at the tap, mounted in each group a part can ride and drawn only in the one the tap rode, so it moves with the
// part it landed on.
export function SpotPinsLayer({ rides }: SpotPinsLayerProps) {
  const tapped = useSceneInputs(selectTapped)
  if (tapped === null || tapped.rides !== rides) {
    return null
  }
  return <SceneAnchor key={tapped.id} id={spotPinId(tapped.spot)} position={[...tapped.point]} />
}

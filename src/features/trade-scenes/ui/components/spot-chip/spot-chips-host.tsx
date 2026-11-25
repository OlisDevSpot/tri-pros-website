'use client'

import type { HomeSpotId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { SpotChips } from '@/features/trade-scenes/ui/components/spot-chip/spot-chips'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SpotChipsHostProps {
  spot: HomeSpotId
}

// The tap's id is the chips' key, so each tap stands a fresh set. Subscribing here, and to the id alone, keeps the canvas
// and the house from re-rendering on every step the chip takes.
export function SpotChipsHost({ spot }: SpotChipsHostProps) {
  const tapId = useSceneInputs((state: TradeSceneInputs) => state.tappedSpot?.id ?? null)
  return tapId === null ? null : <SpotChips key={tapId} spot={spot} />
}

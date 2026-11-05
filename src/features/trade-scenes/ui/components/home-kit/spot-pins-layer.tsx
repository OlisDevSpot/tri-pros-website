'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { HVACType } from '@/shared/modules/construction/core/constants/enums'

import { useShallow } from 'zustand/react/shallow'

import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { homeSpotContext } from '@/features/trade-scenes/lib/keep-look-inside'
import { spotPinId } from '@/features/trade-scenes/lib/spot-pin-id'
import { spotPinPoint } from '@/features/trade-scenes/lib/spot-pin-point'
import { systemsAtSpot } from '@/features/trade-scenes/lib/systems-at-spot'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface SpotPinsLayerProps {
  form: string | null
  hvacType: HVACType | null
}

const NO_SYSTEMS: readonly HomeSystemId[] = []

// Up close the system's own parts take the pins, so a tapped spot shows none there.
function selectSpotSystems(state: TradeSceneInputs): readonly HomeSystemId[] {
  return state.tappedSpot === null || state.lookInside ? NO_SYSTEMS : systemsAtSpot(state.tappedSpot, homeSpotContext(state))
}

// On the house's lift, so each pin rises with the system it names.
export function SpotPinsLayer({ form, hvacType }: SpotPinsLayerProps) {
  const systems = useSceneInputs(useShallow(selectSpotSystems))
  const roofForm = homeRoofForm(form)
  return (
    <>
      {systems.map(system => <SceneAnchor key={system} id={spotPinId(system)} position={[...spotPinPoint(system, roofForm, hvacType)]} />)}
    </>
  )
}

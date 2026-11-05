'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { ArrowLeftIcon, ScanSearchIcon } from 'lucide-react'

import { LOOK_INSIDE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'
import { homeSpotContext } from '@/features/trade-scenes/lib/keep-look-inside'
import { canLookInside } from '@/features/trade-scenes/lib/systems-at-spot'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'

interface LookInsideButtonProps {
  system: HomeSystemId
}

// The card's one step deeper into its system, and the same button back out of it. Only a system with parts to show up
// close on this home offers it.
export function LookInsideButton({ system }: LookInsideButtonProps) {
  const store = useSceneInputsApi<TradeSceneInputs>()
  const lookInside = useSceneInputs((state: TradeSceneInputs) => state.lookInside)
  const offered = useSceneInputs((state: TradeSceneInputs) => canLookInside(system, homeSpotContext(state)))
  if (!offered) {
    return null
  }
  return (
    <Button
      type="button"
      variant="secondary"
      data-look-inside
      onClick={() => store.setState(lookInside ? LEAVE_LOOK_INSIDE : { lookInside: true })}
      className="h-11 w-full rounded-xl"
    >
      {lookInside ? <ArrowLeftIcon aria-hidden /> : <ScanSearchIcon aria-hidden />}
      {lookInside ? LOOK_INSIDE_COPY.close : LOOK_INSIDE_COPY.open}
    </Button>
  )
}

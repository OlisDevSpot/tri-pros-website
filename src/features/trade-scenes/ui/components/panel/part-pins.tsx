'use client'

import type { ReactNode } from 'react'
import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { HomeSystemId, SystemPartId, SystemPartRow, TradeSceneInputs } from '@/features/trade-scenes/types'

import { LOOK_INSIDE } from '@/features/trade-scenes/constants/look-inside'
import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { openPeel } from '@/features/trade-scenes/lib/open-peel'
import { partFromPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { readingFromPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { PartPin } from '@/features/trade-scenes/ui/components/panel/part-pin'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ScenePins } from '@/shared/components/scene/ui/scene-pins'

interface PartPinsProps {
  system: HomeSystemId
  // In the card's list order, so a pin's number is the list's number.
  parts: readonly SystemPartRow[]
  // Only ever one of `parts`: an emphasis whose part is not shown is let go before it gets here.
  emphasized: SystemPartId | null
  // The home's readings, drawn exactly as the home draws them.
  renderReading: (reading: ReadingId) => ReactNode
}

// The system's pin overlay up close, in place of the home's: one overlay owns the shared registry's elements at a time.
// Part pins crowd a closed peel, so they show once it is opened (a system that stands fully open shows them at once), plus
// the emphasised one always; the readings show whenever the home takes them.
export function PartPins({ system, parts, emphasized, renderReading }: PartPinsProps) {
  const open = useSceneInputs((state: TradeSceneInputs) => openPeel(system, state.peel) > LOOK_INSIDE.pinsFromPeel)
  const emphasize = useEmphasizePart()
  const { claimTap } = useSceneTapClaim()

  const shown = (partId: string | null) => partId !== null && (open || partId === emphasized)
  // The pins stand over the canvas, so their tap is a tap on the scene too; a pick answers it, and Look inside stays.
  const select = (partId: SystemPartRow['id']) => {
    claimTap()
    emphasize(partId)
  }

  return (
    <ScenePins
      visible={id => readingFromPinId(id) !== null || shown(partFromPinId(id))}
      render={(id) => {
        const reading = readingFromPinId(id)
        if (reading) {
          return renderReading(reading)
        }
        const index = parts.findIndex(part => part.id === partFromPinId(id))
        if (index < 0) {
          return null
        }
        const part = parts[index]
        return <PartPin number={index + 1} label={part.label} selected={part.id === emphasized} shown={shown(part.id)} onSelect={() => select(part.id)} />
      }}
    />
  )
}

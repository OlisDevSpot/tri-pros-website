'use client'

import type { ReactNode } from 'react'
import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { KIT_MOTION } from '@/features/trade-scenes/constants/assembly-kits'
import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { partFromPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { readingFromPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { PartPin } from '@/features/trade-scenes/ui/components/panel/part-pin'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ScenePins } from '@/shared/components/scene/ui/scene-pins'

interface PartPinsProps {
  // In the part list's order, so a pin's number is the list's number.
  parts: readonly ResolvedPart[]
  // The section pins the home's readings too, drawn exactly as the home draws them.
  renderReading: (reading: ReadingId) => ReactNode
}

// The zoomed kit's pin overlay, in place of the home's: one overlay owns the shared registry's elements at a time. Part pins
// crowd a closed roof, so they show once it is opened, plus the emphasised one always; the readings show whenever the kit pins them.
export function PartPins({ parts, renderReading }: PartPinsProps) {
  const open = useSceneInputs((state: TradeSceneInputs) => state.peel > KIT_MOTION.pinsFromPeel)
  const emphasized = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const emphasize = useEmphasizePart()

  const shown = (partId: string | null) => partId !== null && (open || partId === emphasized)

  return (
    <ScenePins
      visible={id => readingFromPinId(id) !== null || shown(partFromPinId(id))}
      render={(id) => {
        const reading = readingFromPinId(id)
        if (reading) {
          return renderReading(reading)
        }
        const partId = partFromPinId(id)
        const index = parts.findIndex(part => part.id === partId)
        if (partId === null || index < 0) {
          return null
        }
        return <PartPin number={index + 1} label={parts[index].label} selected={partId === emphasized} shown={shown(partId)} onSelect={() => emphasize(partId)} />
      }}
    />
  )
}

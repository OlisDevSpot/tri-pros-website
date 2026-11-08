'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { READING_IDS, readingAnchors } from '@/features/trade-scenes/constants/home-anchors'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { readingPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface ReadingLabelsProps {
  form: string | null
}

// Where each reading is taken; the labels themselves are DOM pins drawn over the canvas at these points.
export function ReadingLabels({ form }: ReadingLabelsProps) {
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const anchors = readingAnchors(homeRoofForm(form), cameraFocus)
  return (
    <>
      {READING_IDS.map(reading => (
        <SceneAnchor key={reading} id={readingPinId(reading)} position={anchors[reading]} />
      ))}
    </>
  )
}

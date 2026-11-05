'use client'

import { READING_ANCHORS, READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { readingPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface ReadingLabelsProps {
  form: string | null
}

// Where each reading is taken; the labels themselves are DOM pins drawn over the canvas at these points.
export function ReadingLabels({ form }: ReadingLabelsProps) {
  const anchors = READING_ANCHORS[homeRoofForm(form)]
  return (
    <>
      {READING_IDS.map(reading => (
        <SceneAnchor key={reading} id={readingPinId(reading)} position={anchors[reading]} />
      ))}
    </>
  )
}

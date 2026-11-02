'use client'

import { HOME_ANCHOR_IDS, HOME_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { anchorPinId } from '@/features/trade-scenes/lib/anchor-pin-id'
import { assemblyAtAnchor } from '@/features/trade-scenes/lib/assembly-at-anchor'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface HomeAnchorsLayerProps {
  form: string | null
}

// Only anchors with a kit get a pin: an anchor with nothing to zoom into would be a dead tap.
const ZOOMABLE = HOME_ANCHOR_IDS.filter(anchor => assemblyAtAnchor(anchor) !== null)

export function HomeAnchorsLayer({ form }: HomeAnchorsLayerProps) {
  const anchors = HOME_ANCHORS[homeRoofForm(form)]
  return (
    <>
      {ZOOMABLE.map(anchor => <SceneAnchor key={anchor} id={anchorPinId(anchor)} position={anchors[anchor].position} />)}
    </>
  )
}

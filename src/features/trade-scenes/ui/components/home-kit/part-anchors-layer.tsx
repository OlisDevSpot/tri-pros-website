'use client'

import type { SystemLit } from '@/features/trade-scenes/types'

import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { partPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface PartAnchorsLayerProps {
  form: string | null
  // The system up close, whose shown parts take a pin each.
  lit: SystemLit | null
}

// On the house's lift, so each pin rises with the part it names.
export function PartAnchorsLayer({ form, lit }: PartAnchorsLayerProps) {
  if (lit === null) {
    return null
  }
  const roofForm = homeRoofForm(form)
  return (
    <>
      {[...lit.shown].map((id) => {
        const point = systemPartFocus(lit.system, roofForm, id)
        return point && <SceneAnchor key={id} id={partPinId(id)} position={[...point]} />
      })}
    </>
  )
}

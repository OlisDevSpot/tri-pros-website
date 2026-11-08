'use client'

import type { SystemLit, TradeSceneInputs, Vec3 } from '@/features/trade-scenes/types'

import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { openPeel } from '@/features/trade-scenes/lib/open-peel'
import { partPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

interface PartAnchorsLayerProps {
  form: string | null
  // The system up close, whose shown parts take a pin each.
  lit: SystemLit | null
  // The run heating & cooling opens, as the house draws it.
  ductRun: readonly Vec3[]
}

// On the house's lift, so each pin rises with the part it names, and along the steps as the peel opens them.
export function PartAnchorsLayer({ form, lit, ductRun }: PartAnchorsLayerProps) {
  const peel = useSceneInputs((state: TradeSceneInputs) => state.lookInside && lit !== null ? openPeel(lit.system, state.peel) : 0)
  if (lit === null) {
    return null
  }
  const roofForm = homeRoofForm(form)
  return (
    <>
      {[...lit.shown].map((id) => {
        const point = systemPartFocus(lit.system, roofForm, id, peel, lit.shown, ductRun)
        return point && <SceneAnchor key={id} id={partPinId(id)} position={[...point]} />
      })}
    </>
  )
}

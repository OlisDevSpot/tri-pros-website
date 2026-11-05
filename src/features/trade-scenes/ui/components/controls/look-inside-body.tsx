'use client'

import type { HomeSystemId, SystemPartId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { systemPartRows } from '@/features/trade-scenes/lib/system-parts-shown'
import { PartList } from '@/features/trade-scenes/ui/components/panel/part-list'
import { PeelControl } from '@/features/trade-scenes/ui/components/panel/peel-control'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface LookInsideBodyProps {
  system: HomeSystemId
}

// Up close the card opens its system: the peel, then every system part it shows, whole parts and pieces in one list.
export function LookInsideBody({ system }: LookInsideBodyProps) {
  const targets = useSceneTargets()
  const emphasized = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const emphasize = useEmphasizePart()
  return (
    <div className="grid gap-3 border-t border-border pt-3">
      <PeelControl />
      {/* The list hands back the ids of the rows it was given. */}
      <PartList parts={systemPartRows(system, targets)} emphasized={emphasized} onEmphasize={partId => emphasize(partId as SystemPartId)} />
    </div>
  )
}

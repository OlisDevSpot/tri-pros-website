'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { PartList } from '@/features/trade-scenes/ui/components/panel/part-list'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface PartsBlockProps {
  zoom: AssemblyId
}

export function PartsBlock({ zoom }: PartsBlockProps) {
  const targets = useSceneTargets()
  const emphasized = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const emphasize = useEmphasizePart()
  const parts = targets.assemblies[zoom]?.parts
  if (!parts) {
    return null
  }
  return <PartList parts={parts} emphasized={emphasized} onEmphasize={emphasize} />
}

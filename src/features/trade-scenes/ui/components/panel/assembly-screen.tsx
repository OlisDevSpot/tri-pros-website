'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import { ASSEMBLY_SCREENS } from '@/features/trade-scenes/constants/assembly-screens'
import { PANEL_SCROLL_CLASS } from '@/features/trade-scenes/constants/panel-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { BackToHomeButton } from '@/features/trade-scenes/ui/components/back-to-home-button'
import { AssemblyScreenBlock } from '@/features/trade-scenes/ui/components/panel/assembly-screen-block'
import { PanelHeader } from '@/features/trade-scenes/ui/components/panel/panel-header'
import { leaveCloseUp } from '@/features/trade-scenes/ui/lib/leave-close-up'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface AssemblyScreenProps {
  zoom: AssemblyId
}

export function AssemblyScreen({ zoom }: AssemblyScreenProps) {
  const store = useSceneInputsApi<TradeSceneInputs>()
  const { stageElement } = useSceneVisibleArea()
  const blocks = ASSEMBLY_SCREENS[zoom] ?? []
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* The way back has the top row, so the heading below keeps the card's full width. */}
      <div className="flex items-start">
        <BackToHomeButton onBack={() => leaveCloseUp(store, stageElement!)} />
      </div>
      <PanelHeader />
      <div className={cn(PANEL_SCROLL_CLASS, '-mt-3 grid content-start gap-6')}>
        {/* An assembly's blocks are a fixed ordered list, so position identifies one even when a later screen repeats a kind. */}
        {blocks.map((block, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <AssemblyScreenBlock key={index} block={block} zoom={zoom} />
        ))}
      </div>
    </div>
  )
}

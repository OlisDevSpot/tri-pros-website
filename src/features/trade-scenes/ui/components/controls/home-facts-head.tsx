'use client'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { ControlsModalHead } from '@/features/trade-scenes/ui/components/controls/controls-modal-head'
import { HomeFactsTabs } from '@/features/trade-scenes/ui/components/controls/home-facts-tabs'

// No tag: on landscape the tabs take the room beside the title.
export function HomeFactsHead() {
  const { shape } = useSceneVisibleArea()
  return (
    <ControlsModalHead icon={CONTROLS_SECTION_ICONS.facts} title={CONTROLS_COPY.sections.facts}>
      {shape === 'landscape' && <HomeFactsTabs />}
    </ControlsModalHead>
  )
}

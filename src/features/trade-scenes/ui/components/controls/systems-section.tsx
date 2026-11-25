'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useLotIsData } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapAway } from '@/features/trade-scenes/hooks/use-scene-tap-away'
import { FocusPing } from '@/features/trade-scenes/ui/components/controls/focus-ping'
import { LotAreasSection } from '@/features/trade-scenes/ui/components/controls/lot-areas-section'
import { SystemActionCard } from '@/features/trade-scenes/ui/components/controls/system-action-card'
import { SystemsRail } from '@/features/trade-scenes/ui/components/controls/systems-rail'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SystemsSectionProps {
  // The rail's id, which the group's Areas button controls.
  railId: string
}

// Areas is no window: the rail above the group, and the card beside the picked system or for the yard held. The
// scene stays bright and the camera stays in hand, so only a tap on the scene puts it away; Look inside is a step into the
// card's system. The yard is the lot's, so only where the lot is data; there the lot's section owns the tap-away, since
// drawing on the lot turns it off.
export function SystemsSection({ railId }: SystemsSectionProps) {
  const { open, picked, close } = useSceneControls()
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const shown = open === 'systems'
  const lotIsData = useLotIsData()
  useSceneTapAway(shown && !lotIsData, close)

  if (!shown) {
    return null
  }
  return (
    <>
      <FocusPing framed={cameraFocus} />
      {picked !== null && <SystemActionCard key={picked} subject={picked} />}
      {lotIsData && <LotAreasSection />}
      <SystemsRail id={railId} />
    </>
  )
}

'use client'

import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapAway } from '@/features/trade-scenes/hooks/use-scene-tap-away'
import { FocusPing } from '@/features/trade-scenes/ui/components/controls/focus-ping'
import { SystemCard } from '@/features/trade-scenes/ui/components/controls/system-card'
import { SystemsRail } from '@/features/trade-scenes/ui/components/controls/systems-rail'

interface SystemsSectionProps {
  // The rail's id, which the group's Systems button controls.
  railId: string
}

// Systems is no window: the rail above the group, and the card beside the system the camera holds. The scene stays bright
// and the camera stays in hand, so only a tap on the scene puts it away; Look inside is a step into the card's system.
export function SystemsSection({ railId }: SystemsSectionProps) {
  const { open, focus, close } = useSceneControls()
  const shown = open === 'systems'
  useSceneTapAway(shown, close)

  if (!shown) {
    return null
  }
  return (
    <>
      <FocusPing focus={focus} />
      {focus !== null && <SystemCard key={focus} focus={focus} />}
      <SystemsRail id={railId} />
    </>
  )
}

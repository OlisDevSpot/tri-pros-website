'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useEffect, useLayoutEffect, useRef } from 'react'

import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapAway } from '@/features/trade-scenes/hooks/use-scene-tap-away'
import { FocusPing } from '@/features/trade-scenes/ui/components/controls/focus-ping'
import { SystemCard } from '@/features/trade-scenes/ui/components/controls/system-card'
import { SystemsRail } from '@/features/trade-scenes/ui/components/controls/systems-rail'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SystemsSectionProps {
  // The rail's id, which the group's Systems button controls.
  railId: string
}

// Systems is no window: the rail above the group, and the card beside the system the camera holds. The scene stays bright
// and the camera stays in hand, so only a tap on the scene, or a zoom into a close-up, puts it away.
export function SystemsSection({ railId }: SystemsSectionProps) {
  const { open, focus, close } = useSceneControls()
  const store = useSceneInputsApi<TradeSceneInputs>()
  const shown = open === 'systems'
  useSceneTapAway(shown, close)
  const latestClose = useRef(close)
  useLayoutEffect(() => {
    latestClose.current = close
  })
  // A pin tap is already a tap away; a pin pressed from the keyboard zooms without one.
  useEffect(() => {
    if (!shown) {
      return
    }
    return store.subscribe((state, previous) => {
      if (state.zoom !== null && previous.zoom === null) {
        latestClose.current()
      }
    })
  }, [shown, store])

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

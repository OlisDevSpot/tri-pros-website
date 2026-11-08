'use client'

import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { SceneChangeSlot, TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { coolRoofOn } from '@/features/trade-scenes/lib/cool-roof-on'
import { UpgradeSwitch } from '@/features/trade-scenes/ui/components/controls/upgrade-switch'
import { FrameColors } from '@/features/trade-scenes/ui/components/panel/frame-colors'
import { PaintColors } from '@/features/trade-scenes/ui/components/panel/paint-colors'
import { ShingleColors } from '@/features/trade-scenes/ui/components/panel/shingle-colors'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface WorkDetailsProps {
  kind: WorkDetailsKind
  // The efficiency switch the work takes, or null where it has none or it is listed elsewhere.
  upgrade: SceneChangeSlot | null
}

// A picked piece of work's colours and its switch, the same wherever they show: in the roof's menu, under a toggle, in Modify.
export function WorkDetails({ kind, upgrade }: WorkDetailsProps) {
  const cool = useSceneInputs((state: TradeSceneInputs) => coolRoofOn(state.proposedScopeIds, state.efficiencyUpgrades))
  switch (kind) {
    case 'shingle':
      return (
        <>
          {upgrade && <div className={CONTROLS_CLASSES.detailsPiece}><UpgradeSwitch slot={upgrade} upgrade="cool-roof" saysWhy /></div>}
          <ShingleColors cool={cool} />
        </>
      )
    case 'membrane':
      return upgrade && <div className={CONTROLS_CLASSES.detailsPiece}><UpgradeSwitch slot={upgrade} upgrade="cool-roof" saysWhy /></div>
    case 'paint':
      return (
        <>
          {upgrade && <div className={CONTROLS_CLASSES.detailsPiece}><UpgradeSwitch slot={upgrade} upgrade="cool-paint" saysWhy={false} /></div>}
          <div className={CONTROLS_CLASSES.detailsPiece}><PaintColors side="proposed" /></div>
        </>
      )
    case 'vinyl-frame':
      return <div className={CONTROLS_CLASSES.detailsPiece}><FrameColors /></div>
  }
}

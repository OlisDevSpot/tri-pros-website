'use client'

import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { SceneChangeSlot, TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { coolRoofOn } from '@/features/trade-scenes/lib/cool-roof-on'
import { MiniSplitHeadCountChoice } from '@/features/trade-scenes/ui/components/controls/mini-split-head-count-choice'
import { ProposedChip } from '@/features/trade-scenes/ui/components/controls/proposed-chip'
import { UpgradeSwitch } from '@/features/trade-scenes/ui/components/controls/upgrade-switch'
import { FrameColors } from '@/features/trade-scenes/ui/components/panel/frame-colors'
import { GutterColors } from '@/features/trade-scenes/ui/components/panel/gutter-colors'
import { PaintColors } from '@/features/trade-scenes/ui/components/panel/paint-colors'
import { ShingleColors } from '@/features/trade-scenes/ui/components/panel/shingle-colors'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface WorkDetailsProps {
  kind: WorkDetailsKind
  // The switch the work takes (its efficiency upgrade, or the indoor unit's move), or null where it has none or it is
  // listed elsewhere.
  upgrade: SceneChangeSlot | null
}

// A picked piece of work's colours and its switch, the same wherever they show: in a build's menu, in Modify.
export function WorkDetails({ kind, upgrade }: WorkDetailsProps) {
  const cool = useSceneInputs((state: TradeSceneInputs) => coolRoofOn(state.proposedScopeIds, state.efficiencyUpgrades))
  const applyChange = useApplySceneChange()
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
    case 'gutter':
      return <div className={CONTROLS_CLASSES.detailsPiece}><GutterColors side="proposed" /></div>
    // An attic home, or a flat roof, has nowhere to move the unit, so its menu holds no empty section.
    case 'indoor-unit':
      return upgrade !== null && upgrade.unavailable === null && (
        <div className={CONTROLS_CLASSES.detailsPiece}>
          <ProposedChip id={upgrade.id} kind="toggle" text={upgrade.name} on={upgrade.current === 'on'} onToggle={() => applyChange(upgrade.change(upgrade.current === 'on' ? 'off' : 'on'))} />
        </div>
      )
    case 'mini-split':
      return <div className={CONTROLS_CLASSES.detailsPiece}><MiniSplitHeadCountChoice /></div>
  }
}

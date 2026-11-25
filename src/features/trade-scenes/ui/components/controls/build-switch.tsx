'use client'

import type { BuildSwitchId } from '@/features/trade-scenes/lib/system-build-entries'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ProposedChip } from '@/features/trade-scenes/ui/components/controls/proposed-chip'
import { UpgradeSwitch } from '@/features/trade-scenes/ui/components/controls/upgrade-switch'

interface BuildSwitchProps {
  id: BuildSwitchId
  slot: SceneChangeSlot
}

// A build row's switch, the same on the system action card and in a spot chip's quick edit. Batts are a look on a picked replace
// only; before one is picked the menu beside it already offers the replace. The fascia replacement is offered only while the
// rep has set rot to replace.
export function BuildSwitch({ id, slot }: BuildSwitchProps) {
  const applyChange = useApplySceneChange()
  switch (id) {
    case 'replace:fascia':
    case 'style:batts': {
      const on = slot.current === 'on'
      return slot.unavailable === null && <ProposedChip id={slot.id} kind="toggle" text={slot.name} on={on} onToggle={() => applyChange(slot.change(on ? 'off' : 'on'))} />
    }
    case 'upgrade:cool-roof':
      return <UpgradeSwitch slot={slot} upgrade="cool-roof" saysWhy />
    case 'upgrade:r8-ducts':
      return <UpgradeSwitch slot={slot} upgrade="r8-ducts" saysWhy={false} />
    case 'upgrade:cool-paint':
      return <UpgradeSwitch slot={slot} upgrade="cool-paint" saysWhy={false} />
    case 'upgrade:r38-insulation':
      return <UpgradeSwitch slot={slot} upgrade="r38-insulation" saysWhy={false} />
  }
}

'use client'

import type { SceneChangeSlot } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { EFFICIENCY_UPGRADE_LABELS, REQUIRED_UPGRADE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ProposedChip } from '@/features/trade-scenes/ui/components/controls/proposed-chip'

interface UpgradeSwitchProps {
  slot: SceneChangeSlot
  upgrade: EfficiencyUpgradeId
  // Says why the upgrade cannot be taken yet, where no chip beside it already does.
  saysWhy: boolean
}

// One switch wherever it shows, on the card's row or in a pick's details: included when the pick cannot go without it, a
// toggle once a pick can take it.
export function UpgradeSwitch({ slot, upgrade, saysWhy }: UpgradeSwitchProps) {
  const applyChange = useApplySceneChange()
  const label = EFFICIENCY_UPGRADE_LABELS[upgrade]
  if (slot.required) {
    return <ProposedChip id={slot.id} kind="reason" label={label} text={label} reason={REQUIRED_UPGRADE_COPY.reason} included />
  }
  if (slot.unavailable === null) {
    const on = slot.current === 'on'
    return <ProposedChip id={slot.id} kind="toggle" text={label} on={on} onToggle={() => applyChange(slot.change(on ? 'off' : 'on'))} />
  }
  return saysWhy && <ProposedChip id={slot.id} kind="reason" label={label} text={label} reason={slot.unavailable} included={false} />
}

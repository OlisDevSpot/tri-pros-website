'use client'

import type { MaterialInputGroupId } from '@/features/trade-scenes/lib/material-input-groups'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { Fragment } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { AIR_SEALING_LABELS, CONTROLS_COPY, GUTTER_LABELS, SCOPES_AND_ADDONS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { WEAR_TONES } from '@/features/trade-scenes/constants/wear-tones'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { materialInputGroupHeader, materialInputGroupIds, ratedMaterial, ridingSlot } from '@/features/trade-scenes/lib/material-input-groups'
import { ConditionMenuGroup } from '@/features/trade-scenes/ui/components/controls/condition-menu-group'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { MaterialInputGroup } from '@/features/trade-scenes/ui/components/controls/material-input-group'
import { ValueMenu } from '@/features/trade-scenes/ui/components/controls/value-menu'

interface ExistingChipProps {
  // The material's own slot, or gutters' or air sealing's.
  slot: SceneChangeSlot
  // Every slot, for the ones that ride with heating & cooling: its indoor unit's location, equipment, AC size and heads.
  slots: readonly SceneChangeSlot[]
  // Null for gutters and air sealing, whose Condition rides on a slot of its own; an absent material has none either.
  material: ResolvedHomeMaterial | null
}

function currentLabel(slot: SceneChangeSlot): string {
  // Modify says Missing for gutters or air sealing not set, but on the chip a home with none reads as having none.
  if (slot.id === 'gutters' && slot.current === null) {
    return GUTTER_LABELS.none
  }
  if (slot.id === 'air-sealing' && slot.current === null) {
    return AIR_SEALING_LABELS.none
  }
  return slot.options.find(option => option.value === slot.current)?.label ?? SCOPES_AND_ADDONS_COPY.notSet
}

// What the home has today, as the chip says it: the option, the AC size on heating & cooling, and the Condition. Its menu
// sets the option and holds whatever else rides with it.
export function ExistingChip({ slot, slots, material }: ExistingChipProps) {
  const applyChange = useApplySceneChange()
  const acTons = slot.id === 'heating-cooling' ? ridingSlot(slots, 'ac-tons') : null
  const gutterWearSlot = slot.id === 'gutters' ? ridingSlot(slots, 'gutter-wear') : null
  const rated = ratedMaterial(material)
  const wear = rated?.wear ?? (gutterWearSlot?.current as Wear | null | undefined) ?? null
  const text = [currentLabel(slot), acTons?.current ? currentLabel(acTons) : null, wear ? WEAR_LABELS[wear] : null].filter(part => part !== null).join(CONTROLS_COPY.systems.valueJoin)
  const groupIds = materialInputGroupIds(slot, slots, material)
  const input = (id: MaterialInputGroupId) => <MaterialInputGroup key={id} id={id} slot={slot} slots={slots} material={material} />
  // A rider is picked among its options as a pill and a colour group is a picker: both sit on one row under their name.
  const row = (id: MaterialInputGroupId, groupSlot: SceneChangeSlot) => (
    <>
      <div data-menu-header className={CONTROLS_CLASSES.menuHeader}>{materialInputGroupHeader(id, groupSlot)}</div>
      <div className={CONTROLS_CLASSES.menuRow}>{input(id)}</div>
    </>
  )
  const groups = [
    ...groupIds.filter(id => id !== 'condition' && id !== 'wear').map(id => ({ id, body: row(id, ridingSlot(slots, id) ?? slot) })),
    groupIds.includes('condition') && {
      id: 'condition',
      body: (
        <ConditionMenuGroup wear={wear}>
          {groupIds.filter(id => id === 'condition' || id === 'wear').map(input)}
        </ConditionMenuGroup>
      ),
    },
  ].filter(group => group !== false)

  return (
    <ValueMenu
      label={slot.name}
      options={slot.options}
      value={slot.current}
      onPick={value => applyChange(slot.change(value))}
      staysOpenOn={value => slot.id === 'gutters' && value === 'present'}
      extra={groups.length > 0 && groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && <div aria-hidden className={CONTROLS_CLASSES.menuSeparator} />}
          {group.body}
        </Fragment>
      ))}
      trigger={(
        <ControlsChip data-existing-chip={slot.id} variant="value" tone={wear ? WEAR_TONES[wear] : undefined} caret>
          {text}
        </ControlsChip>
      )}
    />
  )
}

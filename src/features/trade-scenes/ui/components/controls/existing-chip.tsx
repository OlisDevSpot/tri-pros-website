'use client'

import type { SceneChangeSlot } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { Fragment } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, HOME_MATERIAL_LABELS, SCOPES_AND_ADDONS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { WEAR_TONES } from '@/features/trade-scenes/constants/wear-tones'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { ValueMenu } from '@/features/trade-scenes/ui/components/controls/value-menu'
import { PaintWearFields } from '@/features/trade-scenes/ui/components/panel/paint-wear-fields'
import { WearDots } from '@/features/trade-scenes/ui/components/panel/wear-dots'

interface ExistingChipProps {
  // The material's own slot, or gutters'.
  slot: SceneChangeSlot
  // Every slot, for the ones that ride with heating & cooling: its equipment and AC size.
  slots: readonly SceneChangeSlot[]
  // Null for gutters, which has no Condition; an absent material has none either.
  material: ResolvedHomeMaterial | null
}

function currentLabel(slot: SceneChangeSlot): string {
  return slot.options.find(option => option.value === slot.current)?.label ?? SCOPES_AND_ADDONS_COPY.notSet
}

// What the home has today, as the chip says it: the option, the AC size on heating & cooling, and the Condition. Its menu
// sets the option and holds whatever else rides with it.
export function ExistingChip({ slot, slots, material }: ExistingChipProps) {
  const applyChange = useApplySceneChange()
  const riding = (id: string) => slots.find(candidate => candidate.id === id) ?? null
  const equipment = slot.id === 'heating-cooling' ? riding('hvac-components') : null
  const acTons = slot.id === 'heating-cooling' ? riding('ac-tons') : null
  const rated = material !== null && !material.absent ? material : null
  const text = [currentLabel(slot), acTons?.current ? currentLabel(acTons) : null, rated?.wear ? WEAR_LABELS[rated.wear] : null].filter(part => part !== null).join(CONTROLS_COPY.systems.valueJoin)
  // Picks among a slot's options as a pill: a short list that sits on one row inside the menu.
  const pill = (riders: SceneChangeSlot) => (
    <ChoicePill
      label={riders.name}
      value={riders.current ?? ''}
      options={riders.options.map(option => option.value)}
      labels={Object.fromEntries(riders.options.map(option => [option.value, option.label]))}
      onChange={value => applyChange(riders.change(value))}
    />
  )
  const groups = [
    equipment && { id: equipment.id, header: equipment.name, body: pill(equipment) },
    acTons && { id: acTons.id, header: acTons.name, body: pill(acTons) },
    rated && {
      id: 'condition',
      header: rated.wear ? `${CONTROLS_COPY.systems.condition}${CONTROLS_COPY.systems.valueJoin}${WEAR_LABELS[rated.wear]}` : CONTROLS_COPY.systems.condition,
      body: (
        // The dots keep their own bottom margin for the card's tray; the menu's row already pads them.
        <div className="grid w-full gap-2 @container [&>[data-slot=radio-group]]:mb-0">
          <WearDots material={rated} label={HOME_MATERIAL_LABELS[rated.id]} />
          {rated.id === 'exterior-paint' && <PaintWearFields />}
        </div>
      ),
    },
  ].filter(group => group !== null)

  return (
    <ValueMenu
      label={slot.name}
      options={slot.options}
      value={slot.current}
      onPick={value => applyChange(slot.change(value))}
      extra={groups.length > 0 && groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && <div aria-hidden className={CONTROLS_CLASSES.menuSeparator} />}
          <div data-menu-header className={CONTROLS_CLASSES.menuHeader}>{group.header}</div>
          <div className={CONTROLS_CLASSES.menuRow}>{group.body}</div>
        </Fragment>
      ))}
      trigger={(
        <ControlsChip data-existing-chip={slot.id} variant="value" tone={rated?.wear ? WEAR_TONES[rated.wear] : undefined} caret>
          {text}
        </ControlsChip>
      )}
    />
  )
}

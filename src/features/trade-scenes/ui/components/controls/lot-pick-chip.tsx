'use client'

import type { ReactNode } from 'react'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { CheckIcon, PlusIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { CONTROLS_COPY, LOT_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { NO_CHANGE_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { WEAR_TONES } from '@/features/trade-scenes/constants/wear-tones'
import { ConditionMenuGroup } from '@/features/trade-scenes/ui/components/controls/condition-menu-group'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { ValueMenu } from '@/features/trade-scenes/ui/components/controls/value-menu'
import { WearScale } from '@/features/trade-scenes/ui/components/panel/wear-scale'

type Mixed = 'mixed'

interface LotPickChipProps<T extends string> {
  id: string
  // The name ahead of the value, once there is one.
  keyLabel?: string
  // The menu's heading.
  label: string
  options: readonly { value: T, label: string, group?: string }[]
  value: T | Mixed | null
  // The chip names its value through this, never through the options, so a value outside them still reads as itself.
  labelOf: (value: T) => string
  proposed?: boolean
  // What a chip with no value says: the system to add.
  addText?: string
  // The build's menu ends with Keep what is there.
  keep?: boolean
  wear?: { value: Wear | Mixed | null, onPick: (wear: Wear) => void }
  extra?: ReactNode
  onPick: (value: T | typeof PROPOSED_KEEP) => void
}

// A lot pick on the chip and menu the home's chips use: Today reads as a value with its condition, the build as a pick or
// a dashed chip to add one. A pick may repaint a whole yard's share at once, so its value can be Mixed.
export function LotPickChip<T extends string>({ id, keyLabel, label, options, value, labelOf, proposed = false, addText, keep = false, wear, extra, onPick }: LotPickChipProps<T>) {
  const named = value === null ? null : value === 'mixed' ? LOT_COPY.mixed : labelOf(value)
  const wearText = wear?.value == null ? null : wear.value === 'mixed' ? LOT_COPY.mixed : WEAR_LABELS[wear.value]
  const text = named === null ? addText : [named, proposed ? null : wearText].filter(part => part !== null).join(CONTROLS_COPY.systems.valueJoin)
  const tone = !proposed && wear?.value != null && wear.value !== 'mixed' ? WEAR_TONES[wear.value] : undefined
  // The dots name the ground they rate: the one material, or the chip's own heading over a mix.
  const ground = value !== null && value !== 'mixed' ? labelOf(value) : label
  const choices: readonly { value: T | typeof NO_CHANGE_CHOICE, label: string, group?: string }[] = keep ? [...options, { value: NO_CHANGE_CHOICE, label: LOT_COPY.keep }] : options
  const picked = value === null ? (keep ? NO_CHANGE_CHOICE : null) : value === 'mixed' ? null : value
  const condition = !proposed && wear && (
    <ConditionMenuGroup wear={wear.value}>
      <WearScale value={wear.value === 'mixed' ? null : wear.value} name={ground} label={step => LOT_COPY.wearDot(ground, WEAR_LABELS[step])} onPick={wear.onPick} />
    </ConditionMenuGroup>
  )

  return (
    <ValueMenu
      label={label}
      options={choices}
      value={picked}
      onPick={next => onPick(next === NO_CHANGE_CHOICE ? PROPOSED_KEEP : next)}
      proposed={proposed}
      extra={(condition || extra) && (
        <>
          {condition}
          {condition && extra && <div aria-hidden className={CONTROLS_CLASSES.menuSeparator} />}
          {extra}
        </>
      )}
      trigger={(
        <ControlsChip
          data-lot-chip={id}
          variant={named === null ? 'add' : proposed ? 'on' : 'value'}
          tone={tone}
          icon={named === null ? PlusIcon : proposed ? CheckIcon : undefined}
          keyLabel={named === null ? undefined : keyLabel}
          caret
        >
          {text}
        </ControlsChip>
      )}
    />
  )
}

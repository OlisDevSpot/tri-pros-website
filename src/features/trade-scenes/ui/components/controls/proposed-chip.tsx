'use client'

import type { ReactNode } from 'react'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { CheckIcon, InfoIcon, PlusIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { NO_CHANGE_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { ValueMenu } from '@/features/trade-scenes/ui/components/controls/value-menu'
import { cn } from '@/shared/lib/utils'

// toggle: a build with one thing to add, or an efficiency upgrade; menu: a build with several ways to do it; reason: a
// build or an upgrade the home cannot take yet, which says why. `text` is what the chip says; a menu's `label` heads it,
// and its chip says `add` until a way is picked, then `short` of the picked way's verb.
type ProposedChipProps = { id: string } & (
  | { kind: 'toggle', text: string, on: boolean, onToggle: () => void }
  | { kind: 'menu', label: string, add: string, short: (verb: string) => string, slot: SceneChangeSlot, extra?: ReactNode }
  | { kind: 'reason', label: string, text: string, reason: string | null, included: boolean }
)

// What the Tri Pros build does to the system. A pick here never flips the scene to the build; only the toggle does.
export function ProposedChip(props: ProposedChipProps) {
  const applyChange = useApplySceneChange()
  const { id } = props

  if (props.kind === 'toggle') {
    return (
      <ControlsChip data-proposed-chip={id} variant={props.on ? 'on' : 'add'} icon={props.on ? CheckIcon : PlusIcon} aria-pressed={props.on} onClick={props.onToggle}>
        {props.text}
      </ControlsChip>
    )
  }

  if (props.kind === 'menu') {
    const { label, add, short, slot, extra } = props
    const picked = slot.current !== NO_CHANGE_CHOICE
    return (
      <ValueMenu
        label={label}
        options={slot.options}
        value={slot.current}
        onPick={value => applyChange(slot.change(value))}
        proposed
        extra={extra}
        trigger={(
          <ControlsChip data-proposed-chip={id} variant={picked ? 'on' : 'add'} icon={picked ? CheckIcon : PlusIcon} caret>
            {picked ? short(slot.options.find(option => option.value === slot.current)!.label) : add}
          </ControlsChip>
        )}
      />
    )
  }

  const { label, text, reason, included } = props
  return (
    <ValueMenu
      label={label}
      options={[]}
      value={null}
      // A reason has nothing to pick.
      onPick={() => {}}
      extra={reason !== null && <p className={cn(CONTROLS_CLASSES.menuRow, 'max-w-70 text-xs text-pretty text-muted-foreground')}>{reason}</p>}
      trigger={(
        <ControlsChip data-proposed-chip={id} variant="add" icon={included ? CheckIcon : InfoIcon} aria-disabled caret>
          {text}
        </ControlsChip>
      )}
    />
  )
}

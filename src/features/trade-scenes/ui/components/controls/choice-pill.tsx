'use client'

import type { ChoiceFieldProps } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface ChoicePillProps<T extends string> extends Omit<ChoiceFieldProps<T>, 'value'> {
  // Null presses nothing: a fact with no Not sure, still unset.
  value: T | null
  // Shown, dimmed, and never picked: an option still to come.
  disabled?: readonly T[]
  // An option's name where its label alone would not say enough, such as why it is dimmed.
  names?: Partial<Record<T, string>>
}

// Not sure sits inside the pill as one more option, so a missing fact reads as a choice still to make.
export function ChoicePill<T extends string>({ label, value, options, labels, onChange, disabled, names }: ChoicePillProps<T>) {
  return (
    <ToggleGroup
      aria-label={label}
      type="single"
      value={value ?? ''}
      onValueChange={(next) => {
        // A single toggle group sends '' when the pressed option is tapped again; that tap keeps the pick.
        const picked = options.find(option => option === next)
        if (picked !== undefined) {
          onChange(picked)
        }
      }}
      className={CONTROLS_CLASSES.pill}
    >
      {options.map(option => (
        <ToggleGroupItem key={option} value={option} disabled={disabled?.includes(option)} aria-label={names?.[option]} className={CONTROLS_CLASSES.pillItem}>
          {labels[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

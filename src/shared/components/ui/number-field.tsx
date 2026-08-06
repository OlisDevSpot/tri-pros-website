'use client'

import type * as React from 'react'

import { useState } from 'react'

import { Input } from '@/shared/components/ui/input'

// Everything a normal <input> takes EXCEPT the three we redefine: `value` and
// `onChange` speak numbers here (not strings), and `type` is fixed to 'number'.
// Spreading the rest through means id / aria-* / name / min / max / placeholder /
// className / disabled / onBlur / ref all flow to the underlying input, so this
// drops cleanly into a bare RHF Controller OR a shadcn <FormControl> (Radix Slot
// injects a11y props onto its child, which we forward).
interface Props extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  // The model value. `null` is the canonical "explicitly empty" — never
  // `undefined`, which RHF (and our patch contract) reserves for "untouched"
  // and silently discards. See customer-profiles.ts: "null = clear".
  value: number | null | undefined
  onChange: (value: number | null) => void
}

function toDraft(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

/**
 * The single authoritative binding between a text-based `<input type="number">`
 * and a numeric model value. A number input's display is inherently a string
 * with intermediate states ("", "-", "1.") the model can't hold, so binding a
 * number straight to it creates an impedance mismatch: coercing every keystroke
 * throws those states away and the controlled value fights the user.
 *
 * This owns a local string `draft` for display and commits only resolved values
 * upward — a `number`, or `null` for empty (the explicit clear). Intermediate,
 * not-yet-parseable strings stay in the draft and are NOT pushed to the form, so
 * we never write `NaN` or a numeric string. Form-library-agnostic: feed it
 * `field.value` / `field.onChange` from an RHF Controller, or any controlled parent.
 */
export function NumberField({ value, onChange, ...rest }: Props) {
  const [draft, setDraft] = useState<string>(() => toDraft(value))
  const [lastValue, setLastValue] = useState(value)

  // Re-sync the draft when the model value changes from the outside (form reset,
  // entering edit mode, a programmatic set) — the blessed "adjust state during
  // render" pattern, no effect. A value change the user just caused already
  // matches their draft, so this is a no-op for their own edits; only external
  // changes reset the display.
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(toDraft(value))
  }

  return (
    <Input
      {...rest}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        if (next === '') {
          onChange(null)
          return
        }
        // valueAsNumber is NaN for intermediate strings ("-", "1.") — leave the
        // draft alone and don't push a broken value; it resolves as they finish.
        const num = e.target.valueAsNumber
        if (!Number.isNaN(num)) {
          onChange(num)
        }
      }}
      type="number"
      value={draft}
    />
  )
}

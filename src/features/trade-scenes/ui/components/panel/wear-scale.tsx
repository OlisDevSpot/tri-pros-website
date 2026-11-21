'use client'

import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { WEAR_TONES } from '@/features/trade-scenes/constants/wear-tones'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { wears } from '@/shared/modules/construction/core/constants/enums'

const ARROW_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }

interface WearScaleProps {
  // Null picks no step: a ground of mixed wear, or one not yet rated.
  value: Wear | null
  // The scale's own name, and each dot's.
  name: string
  label: (wear: Wear) => string
  onPick: (wear: Wear) => void
  disabled?: boolean
  // The picked step is a guess, not yet recorded, and its ring says so.
  guessed?: boolean
  // The steps this scale offers, in order; a limited material offers fewer than five.
  choices?: readonly Wear[]
}

// The radios are transparent 40 px targets over the drawn dots, as the scale field's stops are, so arrow keys and the focus
// ring come from Radix while the dots stay plain elements.
export function WearScale({ value, name, label, onPick, disabled = false, guessed = false, choices = wears }: WearScaleProps) {
  return (
    <RadioGroup
      orientation="horizontal"
      aria-label={name}
      value={value ?? ''}
      disabled={disabled}
      // Radix would check the radio an arrow lands on by clicking it, but its keydown listener runs after the focus has moved
      // and sees no arrow, so the group records the step itself, from the radio the arrow leaves.
      onKeyDownCapture={(event) => {
        const step = ARROW_STEPS[event.key]
        const from = choices.findIndex(wear => wear === (event.target as HTMLElement).dataset.wear)
        if (step !== undefined && from >= 0) {
          onPick(choices[(from + step + choices.length) % choices.length])
        }
      }}
      style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
      className={cn('mb-2.5 grid w-full min-w-50 gap-0 @min-[309px]:mb-0 @min-[309px]:w-50', disabled && 'opacity-40')}
    >
      {choices.map((wear) => {
        const picked = value === wear
        return (
          <span key={wear} className="relative size-10 justify-self-center">
            <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className={cn('relative size-5 rounded-full', toneClasses(WEAR_TONES[wear]).dot)}>
                {!picked && <span className="absolute inset-0.5 rounded-full bg-(--card)" />}
                {picked && <span className={cn('absolute -inset-1 rounded-full border-2 border-foreground', guessed && 'border-dashed')} />}
              </span>
            </span>
            <RadioGroupItem
              value={wear}
              aria-label={label(wear)}
              // A radio that is already on does not report a change, and the era's guess is on without being recorded.
              onClick={() => onPick(wear)}
              data-wear={wear}
              className="absolute inset-0 size-10 cursor-pointer rounded-full border-0 bg-transparent shadow-none hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent focus-visible:ring-(--presentation-accent)/50 *:data-[slot=radio-group-indicator]:hidden"
            />
          </span>
        )
      })}
    </RadioGroup>
  )
}

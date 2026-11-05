'use client'

import type { ChoiceFieldProps } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'

import { UNKNOWN_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { FieldLabelRow } from '@/features/trade-scenes/ui/components/fields/field-label-row'
import { NotSureLink } from '@/features/trade-scenes/ui/components/fields/not-sure-link'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface ScaleFieldProps<T extends string> extends ChoiceFieldProps<T> {
  // A row that draws its own label names the scale by it; the field then draws no label row of its own.
  labelledBy?: string
}

// Ordered choices as stops on a track. The drawn track and stops sit under the radio items, which stay transparent hit
// targets on top: the radios keep their roving arrow keys and focus ring, and the stops animate as plain elements.
export function ScaleField<T extends string>({ label, value, options, labels, onChange, labelledBy }: ScaleFieldProps<T>) {
  const ownLabelId = useId()
  const labelId = labelledBy ?? ownLabelId
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion ? { duration: 0 } : SCENE_MOTION.transition
  const stops = options.filter(option => option !== UNKNOWN_CHOICE)
  const unknown = options.find(option => option === UNKNOWN_CHOICE)
  const chosen = stops.indexOf(value)
  const at = (index: number) => `${(index / Math.max(stops.length - 1, 1)) * 100}%`

  return (
    <div className="grid gap-1.5">
      {labelledBy === undefined && (
        <FieldLabelRow
          id={labelId}
          label={label}
          action={(
            <span className="inline-flex items-baseline gap-1.5">
              {chosen >= 0 && <span className="text-sm font-bold text-foreground">{labels[value]}</span>}
              {unknown !== undefined && <NotSureLink pressed={value === unknown} onPress={() => onChange(unknown)} />}
            </span>
          )}
        />
      )}
      <div className="relative mx-3 h-8.5">
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full',
            chosen < 0 ? 'bg-[repeating-linear-gradient(90deg,var(--muted)_0_6px,transparent_6px_11px)]' : 'bg-muted',
          )}
        >
          <motion.span
            className="absolute inset-0 origin-left bg-(--presentation-accent)"
            initial={false}
            animate={{ scaleX: chosen > 0 ? chosen / (stops.length - 1) : 0 }}
            transition={transition}
          />
        </span>
        {stops.map((option, index) => (
          <motion.span
            key={option}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-1/2 size-5 -translate-1/2 rounded-full border-4',
              index === chosen
                ? 'border-foreground bg-(--presentation-accent) ring-4 ring-(--presentation-accent)/25'
                : index < chosen ? 'border-(--presentation-accent) bg-(--presentation-accent)' : 'border-indicator bg-(--card)',
            )}
            style={{ left: at(index) }}
            initial={false}
            // Half size draws the small stop with half the border, so one element serves both sizes.
            animate={{ scale: index === chosen ? 1 : 0.5 }}
            transition={transition}
          />
        ))}
        <RadioGroup
          aria-labelledby={labelId}
          value={value}
          onValueChange={(next) => {
            const picked = stops.find(option => option === next)
            if (picked !== undefined) {
              onChange(picked)
            }
          }}
          className="absolute inset-0 block"
        >
          {stops.map((option, index) => (
            <RadioGroupItem
              key={option}
              value={option}
              aria-label={labels[option]}
              style={{ left: at(index) }}
              className="absolute top-1/2 size-8.5 -translate-1/2 cursor-pointer border-0 bg-transparent shadow-none after:absolute after:-inset-1.25 after:rounded-full hover:bg-hover focus-visible:ring-(--presentation-accent)/50 *:data-[slot=radio-group-indicator]:hidden"
            />
          ))}
        </RadioGroup>
      </div>
      <span className="-mt-0.5 flex justify-between text-xs text-muted-foreground">
        <span>{labels[stops[0]]}</span>
        <span>{labels[stops[stops.length - 1]]}</span>
      </span>
    </div>
  )
}

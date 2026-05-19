'use client'

import type { FilterDefinition } from '@/shared/dal/client/lib/types'
import type { NumberRange } from '@/shared/dal/server/lib/query/schemas'

import { useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Slider } from '@/shared/components/ui/slider'
import { cn } from '@/shared/lib/utils'

interface Props {
  definition: Extract<FilterDefinition, { type: 'number-range' }>
  value: NumberRange | undefined
  onChange: (value: NumberRange | undefined) => void
}

/**
 * Convert URL-state range → effective slider tuple (always within bounds).
 * `undefined` on either side → snap to the matching bound.
 */
function toSliderTuple(value: NumberRange | undefined, bounds: { min: number, max: number }): [number, number] {
  const lo = typeof value?.min === 'number' ? clamp(value.min, bounds.min, bounds.max) : bounds.min
  const hi = typeof value?.max === 'number' ? clamp(value.max, bounds.min, bounds.max) : bounds.max
  return lo <= hi ? [lo, hi] : [hi, lo]
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

/**
 * Drop fields that match the slider bound — empty range = filter inactive.
 * `normalize` in the parser registry then folds an all-empty range to undefined.
 */
function toRange(tuple: [number, number], bounds: { min: number, max: number }): NumberRange | undefined {
  const min = tuple[0] === bounds.min ? undefined : tuple[0]
  const max = tuple[1] === bounds.max ? undefined : tuple[1]
  if (min === undefined && max === undefined) {
    return undefined
  }
  return { min, max }
}

function fmtTriggerLabel(value: NumberRange | undefined, definition: Props['definition']): string {
  if (!value) {
    return `Any ${definition.label.toLowerCase()}`
  }
  const lo = typeof value.min === 'number' ? definition.formatValue(value.min) : `${definition.formatValue(definition.min)}`
  const hi = typeof value.max === 'number' ? definition.formatValue(value.max) : `${definition.formatValue(definition.max)}`
  return `${lo} – ${hi}`
}

export function NumberRangeFilterControl({ definition, value, onChange }: Props) {
  const bounds = { min: definition.min, max: definition.max }
  const step = definition.step ?? 1

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<[number, number]>(() => toSliderTuple(value, bounds))

  // Re-sync draft when external value changes (e.g. ChipRail clear, Reset all).
  // Uses React's documented "adjusting state during rendering" idiom — cheaper
  // than useEffect and avoids a render-then-rerender cycle.
  const prevValueRef = useRef(value)
  if (prevValueRef.current !== value) {
    prevValueRef.current = value
    setDraft(toSliderTuple(value, bounds))
  }

  const isActive = value !== undefined

  function commit(next: [number, number]) {
    setDraft(next)
    onChange(toRange(next, bounds))
  }

  function handleInput(side: 'min' | 'max', raw: string) {
    const parsed = raw === '' ? null : Number(raw.replace(/[^\d.-]/g, ''))
    if (parsed !== null && !Number.isFinite(parsed)) {
      return
    }
    const fallback = side === 'min' ? bounds.min : bounds.max
    const n = parsed === null ? fallback : clamp(parsed, bounds.min, bounds.max)
    const next: [number, number] = side === 'min'
      ? [Math.min(n, draft[1]), draft[1]]
      : [draft[0], Math.max(n, draft[0])]
    commit(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-full justify-start text-left tabular-nums', !isActive && 'text-muted-foreground')}
        >
          <span className="truncate">{fmtTriggerLabel(value, definition)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-baseline justify-between gap-3 border-b border-border/50 px-4 py-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {definition.label}
          </span>
          <span className="font-medium text-sm tabular-nums text-foreground">
            {definition.formatValue(draft[0])}
            <span aria-hidden className="px-1.5 text-muted-foreground/60">–</span>
            {definition.formatValue(draft[1])}
          </span>
        </div>

        <div className="px-4 pt-5 pb-4">
          <Slider
            min={bounds.min}
            max={bounds.max}
            step={step}
            value={draft}
            onValueChange={v => setDraft([v[0], v[1]] as [number, number])}
            onValueCommit={v => onChange(toRange([v[0], v[1]] as [number, number], bounds))}
            aria-label={`${definition.label} range`}
            minStepsBetweenThumbs={1}
          />
          <div className="mt-2 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground/70">
            <span>{definition.formatValue(bounds.min)}</span>
            <span>{definition.formatValue(bounds.max)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border/50 px-4 py-3">
          <NumberField
            label="Min"
            value={draft[0]}
            ariaLabel={`Minimum ${definition.label.toLowerCase()}`}
            onChange={raw => handleInput('min', raw)}
          />
          <NumberField
            label="Max"
            value={draft[1]}
            ariaLabel={`Maximum ${definition.label.toLowerCase()}`}
            onChange={raw => handleInput('max', raw)}
          />
        </div>

        {isActive && (
          <div className="flex justify-end border-t border-border/50 px-4 py-2">
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className={cn(
                'rounded text-xs text-muted-foreground transition-colors',
                'hover:text-foreground',
                'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
              )}
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  ariaLabel: string
  onChange: (raw: string) => void
}

function NumberField({ label, value, ariaLabel, onChange }: NumberFieldProps) {
  const [raw, setRaw] = useState<string>(() => String(value))

  // Sync raw when external value changes (slider drag updates parent draft).
  const prevValueRef = useRef(value)
  if (prevValueRef.current !== value) {
    prevValueRef.current = value
    setRaw(String(value))
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => onChange(raw)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onChange(raw)
          }
        }}
        aria-label={ariaLabel}
        className="h-8 tabular-nums"
      />
    </label>
  )
}

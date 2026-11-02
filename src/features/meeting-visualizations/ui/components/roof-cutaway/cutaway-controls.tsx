'use client'

import type { BuildState } from '@/features/meeting-visualizations/types'
import { Slider } from '@/shared/components/ui/slider'
import { cn } from '@/shared/lib/utils'

interface BuildToggleProps {
  build: BuildState
  todayLabel: string
  onChange: (build: BuildState) => void
}

export function BuildToggle({ build, todayLabel, onChange }: BuildToggleProps) {
  const options: Array<{ value: BuildState, label: string }> = [
    { value: 'today', label: todayLabel },
    { value: 'tri-pros', label: 'The Tri Pros build' },
  ]
  return (
    <div role="group" aria-label="Which roof to show" className="grid grid-cols-2 gap-1 rounded-xl border border-white/15 bg-white/5 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={build === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-(--presentation-accent)',
            build === option.value ? 'bg-white text-(--presentation-ground) shadow-md' : 'text-white/75 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface ExplodeControlProps {
  value: number
  onChange: (value: number) => void
}

/** A slider for the slow reveal, plus one tap to open or close it fully while talking. */
export function ExplodeControl({ value, onChange }: ExplodeControlProps) {
  const open = value > 0.5
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span id="explode-label" className="text-sm font-semibold text-white/85">Peel back the layers</span>
        <button
          type="button"
          onClick={() => onChange(open ? 0 : 1)}
          className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-(--presentation-accent) hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-(--presentation-accent)"
        >
          {open ? 'Close it up' : 'Open it up'}
        </button>
      </div>
      <Slider
        aria-labelledby="explode-label"
        value={[value * 100]}
        onValueChange={([next]) => onChange((next ?? 0) / 100)}
        max={100}
        step={1}
        className="h-11 **:data-[slot=slider-range]:bg-(--presentation-accent) **:data-[slot=slider-thumb]:size-7 **:data-[slot=slider-thumb]:border-(--presentation-accent) **:data-[slot=slider-thumb]:bg-white **:data-[slot=slider-track]:h-2 **:data-[slot=slider-track]:bg-white/15"
      />
    </div>
  )
}

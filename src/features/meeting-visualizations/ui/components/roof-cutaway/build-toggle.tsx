'use client'

import type { BuildState } from '@/features/meeting-visualizations/types'
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
    <div role="group" aria-label="Which roof to show" className="grid grid-cols-2 gap-1 rounded-xl border border-on-media/15 bg-on-media/5 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={build === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-(--presentation-accent)',
            build === option.value ? 'bg-on-media text-(--presentation-ground) shadow-md' : 'text-on-media/75 hover:text-on-media',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

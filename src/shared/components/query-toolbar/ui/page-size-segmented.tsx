'use client'

import { cn } from '@/shared/lib/utils'

interface PageSizeSegmentedProps {
  options: readonly number[]
  value: number
  onChange: (next: number) => void
}

export function PageSizeSegmented({ options, value, onChange }: PageSizeSegmentedProps) {
  return (
    <div role="radiogroup" aria-label="Rows per page" className="flex gap-1 rounded-md border border-border p-1">
      {options.map((opt) => {
        const selected = opt === value
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={cn(
              'h-9 flex-1 rounded-sm text-sm font-medium tabular-nums touch-manipulation transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
              selected
                ? 'bg-row-selected text-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

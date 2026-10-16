'use client'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface PageSizeSegmentedProps {
  options: readonly number[]
  value: number
  onChange: (next: number) => void
}

export function PageSizeSegmented({ options, value, onChange }: PageSizeSegmentedProps) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={String(value)}
      onValueChange={(next) => {
        const size = options.find(opt => String(opt) === next)
        if (size !== undefined) {
          onChange(size)
        }
      }}
      aria-label="Rows per page"
      className="w-full"
    >
      {options.map(opt => (
        <ToggleGroupItem key={opt} value={String(opt)} className="h-9.5 flex-1 tabular-nums touch-manipulation">
          {opt}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

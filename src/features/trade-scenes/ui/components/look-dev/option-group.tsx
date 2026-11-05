'use client'

import { useId } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface OptionGroupProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}

export function OptionGroup<T extends string>({ label, value, options, labels, onChange }: OptionGroupProps<T>) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <ToggleGroup aria-labelledby={labelId} type="single" variant="outline" value={value} onValueChange={next => next && onChange(next as T)}>
        {options.map(option => (
          <ToggleGroupItem key={option} value={option} className="h-11 px-3.5">{labels[option]}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

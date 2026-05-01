'use client'

import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props {
  definition: Extract<FilterDefinition, { type: 'select' }>
  value: string | undefined
  onChange: (value: string | undefined) => void
}

const ALL_VALUE = '__all__'

export function SelectFilterControl({ definition, value, onChange }: Props) {
  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={next => onChange(next === ALL_VALUE ? undefined : next)}
    >
      <SelectTrigger className="w-full md:w-44">
        <SelectValue placeholder={definition.placeholder ?? definition.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All</SelectItem>
        {definition.options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

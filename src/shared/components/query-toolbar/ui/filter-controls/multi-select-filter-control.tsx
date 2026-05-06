'use client'

import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/shared/components/ui/multi-select'

interface Props {
  definition: Extract<FilterDefinition, { type: 'multi-select' }>
  value: string[] | undefined
  onChange: (value: string[] | undefined) => void
}

export function MultiSelectFilterControl({ definition, value, onChange }: Props) {
  const current = value ?? []
  return (
    <MultiSelect
      values={current}
      onValuesChange={next => onChange(next.length > 0 ? next : undefined)}
    >
      <MultiSelectTrigger className="w-full">
        <MultiSelectValue placeholder={definition.placeholder ?? 'Any'} />
      </MultiSelectTrigger>
      <MultiSelectContent search={{ placeholder: `Search ${definition.label.toLowerCase()}…` }}>
        <MultiSelectGroup>
          {definition.options.map(option => (
            <MultiSelectItem key={option.value} value={option.value}>
              {option.label}
            </MultiSelectItem>
          ))}
        </MultiSelectGroup>
      </MultiSelectContent>
    </MultiSelect>
  )
}

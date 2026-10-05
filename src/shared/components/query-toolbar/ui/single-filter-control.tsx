'use client'

import type { FilterDefinition, FilterValue } from '@/shared/dal/client/lib/types'

import { filterRendererRegistry } from '@/shared/components/query-toolbar/lib/filter-renderer-registry'

interface SingleFilterControlProps {
  definition: FilterDefinition
  value: FilterValue
  onChange: (v: FilterValue) => void
}

export function SingleFilterControl({ definition, value, onChange }: SingleFilterControlProps) {
  switch (definition.type) {
    case 'select': {
      const Render = filterRendererRegistry.select
      return (
        <Render
          definition={definition}
          value={value as string | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'multi-select': {
      const Render = filterRendererRegistry['multi-select']
      return (
        <Render
          definition={definition}
          value={value as string[] | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'date-range': {
      const Render = filterRendererRegistry['date-range']
      return (
        <Render
          definition={definition}
          value={value as { from?: string, to?: string } | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'number-range': {
      const Render = filterRendererRegistry['number-range']
      return (
        <Render
          definition={definition}
          value={value as { min?: number, max?: number } | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'boolean': {
      const Render = filterRendererRegistry.boolean
      return (
        <Render
          definition={definition}
          value={value as boolean | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
  }
}

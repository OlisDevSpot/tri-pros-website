'use client'

import type { ComponentType } from 'react'

import type { FilterDefinition } from '@/shared/dal/client/query/types'
import type { DateRange } from '@/shared/dal/server/query/schemas'

import { BooleanFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/boolean-filter-control'
import { DateRangeFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/date-range-filter-control'
import { MultiSelectFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/multi-select-filter-control'
import { SelectFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/select-filter-control'

/**
 * Compile-time registry mapping each filter type to its renderer component.
 * Adding a new filter type requires:
 *   1. Add the variant to `FilterDefinition`
 *   2. Add a parser+normalize entry in `filter-parser-registry.ts`
 *   3. Add a Render entry here
 *
 * The `as const` + `satisfies` keep the union exhaustive at compile time.
 */
type FilterType = FilterDefinition['type']

interface RendererProps<TDef extends FilterDefinition, TValue> {
  definition: TDef
  value: TValue | undefined
  onChange: (value: TValue | undefined) => void
}

type RendererFor<T extends FilterType, TValue> = ComponentType<
  RendererProps<Extract<FilterDefinition, { type: T }>, TValue>
>

interface FilterRendererRegistry {
  'select': RendererFor<'select', string>
  'multi-select': RendererFor<'multi-select', string[]>
  'date-range': RendererFor<'date-range', DateRange>
  'boolean': RendererFor<'boolean', boolean>
}

export const filterRendererRegistry: FilterRendererRegistry = {
  'select': SelectFilterControl,
  'multi-select': MultiSelectFilterControl,
  'date-range': DateRangeFilterControl,
  'boolean': BooleanFilterControl,
}

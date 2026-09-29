import type { FilterDefinition } from '@/shared/dal/client/lib/types'
import type { FieldList, FilterOption, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'

export interface ToolbarFilter {
  definition: FilterDefinition
  /** Its runtime options haven't loaded, were refused or aren't permitted: no control, but an active URL value still gets a chip. */
  hidden: boolean
}

type LoadedOptions = Partial<Record<string, readonly FilterOption[]>>

function toFilterDefinition(id: string, label: string, filter: ToolbarFilterSpec, runtimeOptions: readonly FilterOption[]): FilterDefinition {
  switch (filter.kind) {
    case 'multi-select':
      return { id, type: 'multi-select', label, placeholder: filter.placeholder, options: 'source' in filter.options ? runtimeOptions : filter.options }
    case 'select':
      return { id, type: 'select', label, placeholder: filter.placeholder, options: 'source' in filter.options ? runtimeOptions : filter.options }
    case 'date-range':
      return { id, type: 'date-range', label, presets: DEFAULT_TIME_PRESETS }
    case 'number-range':
      return { id, type: 'number-range', label, min: filter.min, max: filter.max, step: filter.step, formatValue: filter.formatValue }
    case 'boolean':
      return { id, type: 'boolean', label }
  }
}

/** Turns toolbar fields into the existing control descriptors, so every filter kind reuses its renderer. */
export function toToolbarFilters(fields: FieldList, toolbar: readonly string[], options: LoadedOptions): ToolbarFilter[] {
  return toolbar.map((id) => {
    const field = fields[id]
    const filter = field.filter as ToolbarFilterSpec
    const isRuntime = (filter.kind === 'multi-select' || filter.kind === 'select') && 'source' in filter.options
    const loaded = isRuntime ? options[id] : undefined
    return {
      definition: toFilterDefinition(id, field.label ?? id, filter, loaded ?? []),
      hidden: isRuntime && loaded === undefined,
    }
  })
}

export function toSortOptions(fields: FieldList): FilterOption[] {
  return Object.entries(fields).flatMap(([id, field]) => (field.sort ? [{ value: id, label: field.label ?? id }] : []))
}

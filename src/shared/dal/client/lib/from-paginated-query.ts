import type { DataViewQueryResult, FilterDefinition, FilterValue, PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'

import z from 'zod'

import { dateRangeSchema, numberRangeSchema } from '@/shared/dal/lib/query/range-schemas'

// Every legacy date-range definition uses the default presets, which the toolbar supplies.
function toFilterSpec(definition: FilterDefinition): ToolbarFilterSpec {
  switch (definition.type) {
    case 'multi-select':
      return { kind: 'multi-select', schema: z.array(z.string()), options: definition.options, placeholder: definition.placeholder }
    case 'select':
      return { kind: 'select', schema: z.string(), options: definition.options, placeholder: definition.placeholder }
    case 'date-range':
      return { kind: 'date-range', schema: dateRangeSchema }
    case 'number-range':
      return { kind: 'number-range', schema: numberRangeSchema, min: definition.min, max: definition.max, step: definition.step, formatValue: definition.formatValue }
    case 'boolean':
      return { kind: 'boolean', schema: z.boolean() }
  }
}

/** Lets a table still on `usePaginatedQuery` (proposals, projects, campaign leads) use the data-view toolbar and table adapters. */
export function fromPaginatedQuery<TRow>(result: PaginatedQueryResult<TRow>): DataViewQueryResult<TRow, FieldList, string, 'page'> {
  const fields: FieldList = Object.fromEntries(
    result.filterDefinitions.map(definition => [definition.id, { label: definition.label, filter: toFilterSpec(definition) }]),
  )
  return {
    rows: result.rows,
    total: result.total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    refresh: result.refresh,
    filterSort: {
      fields,
      toolbar: result.filterDefinitions.map(definition => definition.id),
      filters: result.filters,
      options: {},
      activeFilterCount: result.activeFilterCount,
      setFilter: (id, value) => result.setFilter(id, value as FilterValue),
      clearFilters: result.clearFilters,
      search: result.search,
      setSearch: result.setSearch,
      sortBy: result.sortBy,
      sortDir: result.sortDir,
      setSort: result.setSort,
    },
    window: {
      kind: 'page',
      page: result.page,
      pageSize: result.pageSize,
      pageSizeOptions: result.pageSizeOptions ?? [result.pageSize],
      pageCount: result.pageCount,
      setPage: result.setPage,
      setPageSize: result.setPageSize,
    },
  }
}

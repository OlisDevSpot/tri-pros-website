import type { DateRange } from '@/shared/dal/server/query/schemas'

/**
 * Time-preset descriptor for `date-range` filter type. Click a preset → fill
 * `{ from, to }` from `getRange()`. UI renderers also offer a custom-range
 * mode for picking arbitrary windows.
 */
export interface TimePreset {
  label: string
  value: string
  getRange: () => DateRange
}

/**
 * Single-value option for `select` and `multi-select` filter types.
 */
export interface FilterOption {
  label: string
  value: string
}

/**
 * Discriminated union of supported filter types. Each variant determines:
 *   - URL parser (via `filterParserRegistry`)
 *   - Normalizer for server input (via `filterParserRegistry`)
 *   - UI renderer (via `filterRendererRegistry`)
 *
 * Adding a new filter type requires entries in both registries.
 *
 * `id` is BOTH the URL key suffix (e.g. `?src_status=...`) AND the procedure
 * input field name under `filters.{id}`. Keep ids short and snake_friendly.
 */
export type FilterDefinition
  = | {
    id: string
    type: 'select'
    label: string
    placeholder?: string
    options: readonly FilterOption[]
  }
  | {
    id: string
    type: 'multi-select'
    label: string
    placeholder?: string
    options: readonly FilterOption[]
  }
  | {
    id: string
    type: 'date-range'
    label: string
    presets?: readonly TimePreset[]
  }
  | {
    id: string
    type: 'boolean'
    label: string
  }

/**
 * Filter URL/state value union — discriminated by the FilterDefinition's type.
 * UI renderers and consumers narrow against this when reading/writing.
 */
export type FilterValue
  = | string
    | string[]
    | DateRange
    | boolean
    | undefined

/**
 * The current filter state, keyed by filter id. Values reflect URL state and
 * have already been normalized (empty string → undefined, [] → undefined,
 * empty range → undefined).
 */
export type FilterState = Record<string, FilterValue>

/**
 * UI-agnostic shape returned by `usePaginatedQuery`. Any data view container
 * (table, kanban, calendar, card grid) consumes this via thin adapters.
 *
 * Pagination is 1-indexed at the surface (matches URLs like `?p=2`); adapters
 * convert to 0-indexed when their underlying lib expects it (e.g. TanStack
 * Table's `pageIndex`).
 */
export interface PaginatedQueryResult<TRow> {
  // -- Data --
  rows: TRow[]
  total: number

  // -- Page state --
  page: number
  pageSize: number
  pageSizeOptions: readonly number[] | undefined
  pageCount: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void

  // -- Search (debounced internally) --
  /** Raw input value — bind to a controlled `<input>`. */
  searchInput: string
  /** Updates raw input and resets `page` to 1 atomically. */
  setSearchInput: (value: string) => void
  /** Debounced value the underlying query actually uses. */
  searchDebounced: string

  // -- Sort --
  sortBy: string | undefined
  sortDir: 'asc' | 'desc' | undefined
  /** Updates sort and resets `page` to 1 atomically. */
  setSort: (sortBy: string | undefined, sortDir?: 'asc' | 'desc') => void

  // -- Filters --
  filterDefinitions: readonly FilterDefinition[]
  filters: FilterState
  /** Updates one filter value and resets `page` to 1 atomically. */
  setFilter: (id: string, value: FilterValue) => void
  /** Clears all filters AND search AND sort, resets page to 1. */
  clearFilters: () => void
  activeFilterCount: number

  // -- Query state --
  isLoading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  isError: boolean
  error: unknown
}

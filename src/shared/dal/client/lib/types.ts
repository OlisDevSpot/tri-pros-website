import type { DecorateQueryProcedure, inferOutput } from '@trpc/tanstack-react-query'
import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewWindowKind } from '@/shared/dal/lib/query/data-view-query-config'
import type { FilterValue as FieldFilterValue, FieldList, FilterOption, RuntimeOptionId, SortDir, SortId, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'
import type { DateRange, NumberRange } from '@/shared/dal/lib/query/range-schemas'

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
    type: 'number-range'
    label: string
    /** Inclusive lower bound of the slider (e.g. 0). */
    min: number
    /** Inclusive upper bound of the slider (e.g. 300_000). */
    max: number
    /** Slider step (e.g. 1000 for $1k increments). Defaults to 1. */
    step?: number
    /** Format a single value for the popover header and chip rail. */
    formatValue: (n: number) => string
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
    | NumberRange
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

  // -- Refresh --
  /**
   * Invalidate every cached page of this table's tRPC procedure and refetch
   * the active page(s). Resolves when the refetches settle — pull-to-refresh
   * awaits this; the toolbar button spins on `isFetching`.
   */
  refresh: () => Promise<void>
}

/** Every data-view read returns `{ rows, total }`; this reads the row type off the tRPC procedure. */
export type DataViewRowOf<TProcedure extends DecorateQueryProcedure<any>> = inferOutput<TProcedure> extends PaginatedResult<infer TRow> ? TRow : never

export interface DataViewFilterSort<F extends FieldList, T extends ToolbarFilterId<F> = ToolbarFilterId<F>> {
  fields: F
  toolbar: readonly T[]
  /** Active toolbar values only. */
  filters: { [K in T]?: FieldFilterValue<F, K> }
  /** Loaded choices for the toolbar's runtime-option filters; a missing entry (loading, refused, not permitted) hides that filter. */
  options: { [K in Extract<RuntimeOptionId<F>, T>]?: readonly FilterOption[] }
  activeFilterCount: number
  /** Resets the page to 1; never moves a date window. */
  setFilter: <K extends T>(id: K, value: FieldFilterValue<F, K> | undefined) => void
  /** Clears toolbar filters, search and sort; leaves the window alone. */
  clearFilters: () => void
  searchInput: string
  setSearchInput: (value: string) => void
  sortBy: SortId<F> | undefined
  sortDir: SortDir | undefined
  setSort: (sortBy: SortId<F> | undefined, sortDir?: SortDir) => void
}

export interface PageWindowControls {
  kind: 'page'
  page: number
  pageSize: number
  pageSizeOptions: readonly number[]
  pageCount: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
}

export interface DateWindowControls {
  kind: 'date'
  /** `YYYY-MM-DD` in the business timezone. */
  anchor: string
  view: CalendarViewType
  range: { from: string, to: string }
  cap: number
  /** `undefined` returns to today. */
  setAnchor: (calendarDay: string | undefined) => void
  setView: (view: CalendarViewType) => void
}

export type DataViewWindowControls<K extends DataViewWindowKind = DataViewWindowKind> = Extract<
  PageWindowControls | DateWindowControls | { kind: 'whole-list' },
  { kind: K }
>

/** What `useDataViewQuery` returns: plain data and setters, safe to pass down as props. */
export interface DataViewQueryResult<
  TRow,
  F extends FieldList,
  T extends ToolbarFilterId<F> = ToolbarFilterId<F>,
  K extends DataViewWindowKind = DataViewWindowKind,
> {
  rows: TRow[]
  total: number
  isLoading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  isError: boolean
  error: unknown
  /** Invalidates every cached input of this procedure; resolves when the refetch settles. */
  refresh: () => Promise<void>
  filterSort: DataViewFilterSort<F, T>
  window: DataViewWindowControls<K>
}

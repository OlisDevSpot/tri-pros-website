// -- Date range shape used by time-preset filter --

export interface DateRange {
  from: string
  to: string
}

export interface TimePreset {
  label: string
  value: string
  getRange: () => DateRange
}

// -- Discriminated union for filter configs --

interface DataTableFilterBase {
  id: string
  label: string
  columnId: string
}

export interface DataTableSearchFilter extends DataTableFilterBase {
  type: 'search'
  placeholder?: string
}

export interface DataTableSelectFilter extends DataTableFilterBase {
  type: 'select'
  placeholder?: string
  options: readonly { label: string, value: string }[]
}

export interface DataTableTimePresetFilter extends DataTableFilterBase {
  type: 'time-preset'
  presets: readonly TimePreset[]
}

export interface DataTableMultiSelectFilter extends DataTableFilterBase {
  type: 'multi-select'
  placeholder?: string
  options: readonly { label: string, value: string }[]
}

/**
 * @deprecated Use `<QueryToolbar>` + `usePaginatedQuery` for new tables. This
 * client-side filter config is still supported for legacy paths that haven't
 * been migrated yet (Activities, Past Meetings, Past Proposals, Projects,
 * Customer Pipelines). Each migration is queued as a follow-up issue.
 */
export type DataTableFilterConfig
  = DataTableSearchFilter
    | DataTableSelectFilter
    | DataTableMultiSelectFilter
    | DataTableTimePresetFilter

// -- Server-side pagination control --

/**
 * Controlled pagination state for server-paged tables. When present, DataTable
 * switches to `manualPagination` — caller passes the current-page slice as
 * `data` and reports the global row count via `rowCount`.
 *
 * Built by `toDataTablePagination(p)` from a `usePaginatedQuery` result.
 */
export interface DataTableServerPagination {
  pageIndex: number
  pageSize: number
  rowCount: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  /** When provided, the pagination footer renders a page-size selector. */
  pageSizeOptions?: readonly number[]
  /** When true, render a muted "Loading…" hint in the pagination bar. */
  isFetching?: boolean
  /** When true, the empty-state slot renders an error message instead of "no rows". */
  isError?: boolean
  /**
   * Invalidate + refetch the whole dataset for this table's procedure. Wired to
   * pull-to-refresh in DataTable. Forwarded from `usePaginatedQuery().refresh`.
   */
  onRefresh?: () => Promise<unknown> | void
}

// -- Server-side sort control --

/**
 * Controlled sort state for server-sorted tables. When present, DataTable
 * switches to `manualSorting` — caller drives the order, and column-header
 * clicks emit `onSortChange` events that the caller routes back to its
 * server query.
 *
 * `fallbackVisual` is used to populate the visible sort indicator when the
 * server is using its natural fallback order (no explicit `sortBy`); the
 * URL state stays clean while the column header still shows the down-arrow.
 *
 * Built by `toDataTableSorting(p, opts)` from a `usePaginatedQuery` result.
 */
export interface DataTableServerSorting {
  sortBy: string | undefined
  sortDir: 'asc' | 'desc' | undefined
  onSortChange: (sortBy: string | undefined, sortDir?: 'asc' | 'desc') => void
  /** Visual default when `sortBy` is undefined; matches the server fallback. */
  fallbackVisual?: { id: string, desc: boolean }
}

import type { ColumnDef, SortingState } from '@tanstack/react-table'

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

// -- DataTable props --

export interface DataTableProps<TData, TMeta = unknown> {
  data: TData[]
  columns: ColumnDef<TData>[]
  meta?: TMeta
  /** Unique ID used to persist column widths to localStorage. Omit to disable persistence. */
  tableId?: string
  filterConfig?: DataTableFilterConfig[]
  defaultSort?: SortingState
  /** Client-side page size. Ignored when `serverPagination` is provided. */
  pageSize?: number
  entityName?: string
  rowDataAttribute?: string
  getRowClassName?: (row: TData) => string | undefined
  onRowClick?: (row: TData) => void
  onFilteredCountChange?: (count: number) => void
  onFilteredDataChange?: (data: TData[]) => void
  /**
   * Opt into server-side pagination. When set, the caller owns page state and
   * passes only the current page's rows via `data`. `rowCount` reports the
   * global total so page-count math stays correct.
   */
  serverPagination?: DataTableServerPagination
  /**
   * Opt into server-side sorting. When set, DataTable runs in `manualSorting`
   * mode — column-header clicks emit `onSortChange` events instead of doing
   * client-side sort. Pair with `serverPagination` for fully server-controlled
   * tables.
   */
  serverSorting?: DataTableServerSorting
}

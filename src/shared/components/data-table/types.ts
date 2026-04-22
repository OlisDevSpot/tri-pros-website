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
 */
export interface DataTableServerPagination {
  pageIndex: number
  pageSize: number
  rowCount: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  /** When true, render a muted "Loading…" hint in the pagination bar. */
  isFetching?: boolean
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
}

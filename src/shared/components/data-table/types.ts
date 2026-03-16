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

export type DataTableFilterConfig
  = DataTableSearchFilter
    | DataTableSelectFilter
    | DataTableTimePresetFilter

// -- DataTable props --

export interface DataTableProps<TData, TMeta = unknown> {
  data: TData[]
  columns: ColumnDef<TData>[]
  meta?: TMeta
  filterConfig?: DataTableFilterConfig[]
  defaultSort?: SortingState
  pageSize?: number
  entityName?: string
  rowDataAttribute?: string
  onRowClick?: (row: TData) => void
  onFilteredCountChange?: (count: number) => void
}

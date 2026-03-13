import type { ColumnDef, SortingState } from '@tanstack/react-table'

export interface DataTableFilterConfig {
  id: string
  label: string
  type: 'search' | 'select'
  columnId: string
  options?: readonly { label: string, value: string }[]
  placeholder?: string
}

export interface DataTableProps<TData, TMeta = unknown> {
  data: TData[]
  columns: ColumnDef<TData>[]
  meta?: TMeta
  filterConfig?: DataTableFilterConfig[]
  defaultSort?: SortingState
  pageSize?: number
  entityName?: string
  rowDataAttribute?: string
}

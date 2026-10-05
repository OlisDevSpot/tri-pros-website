import type { ColumnDef } from '@tanstack/react-table'

export function getColumnId<TData>(col: ColumnDef<TData>): string | undefined {
  if ('id' in col && typeof col.id === 'string') {
    return col.id
  }
  if ('accessorKey' in col && typeof col.accessorKey === 'string') {
    return col.accessorKey
  }
  return undefined
}

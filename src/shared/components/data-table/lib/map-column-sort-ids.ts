import type { ColumnDef } from '@tanstack/react-table'

import { getColumnId } from '@/shared/components/data-table/lib/get-column-id'

/** Column keys and server sort ids differ (the Rep column sorts by `rep`), so header state is translated both ways. */
export function mapColumnSortIds<TData>(columns: readonly ColumnDef<TData>[]): {
  sortIdByColumnId: ReadonlyMap<string, string>
  columnIdBySortId: ReadonlyMap<string, string>
} {
  const sortIdByColumnId = new Map<string, string>()
  const columnIdBySortId = new Map<string, string>()
  for (const col of columns) {
    const id = getColumnId(col)
    const sortId = (col.meta as { sortId?: string } | undefined)?.sortId
    if (id && sortId) {
      sortIdByColumnId.set(id, sortId)
      columnIdBySortId.set(sortId, id)
    }
  }
  return { sortIdByColumnId, columnIdBySortId }
}

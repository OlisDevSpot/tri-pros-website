import type { DataTableServerSorting } from '@/shared/components/data-table/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, SortId, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

interface ToDataTableSortingOptions {
  /** Arrow shown when no sort is set (legacy reads fall back to newest first); a sort id, not a column id. */
  fallbackVisual?: { id: string, desc: boolean }
}

export function toDataTableSorting<F extends FieldList, T extends ToolbarFilterId<F>>(
  query: DataViewQueryResult<unknown, F, T>,
  options: ToDataTableSortingOptions = {},
): DataTableServerSorting {
  const { sortBy, sortDir, setSort } = query.filterSort
  return {
    sortBy,
    sortDir,
    // DataTable only emits sort ids read from column `meta`, and registries type those as SortId<F>.
    onSortChange: (next, nextDir) => setSort(next as SortId<F> | undefined, nextDir),
    fallbackVisual: options.fallbackVisual ?? { id: 'createdAt', desc: true },
  }
}

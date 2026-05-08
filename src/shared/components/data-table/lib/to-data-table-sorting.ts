import type { DataTableServerSorting } from '@/shared/components/data-table/types'
import type { PaginatedQueryResult } from '@/shared/dal/client/query/types'

interface ToDataTableSortingOptions {
  /**
   * Visual default for the column-header sort indicator when the server is
   * using its natural fallback order (no explicit `sortBy`). The URL state
   * stays clean (?sort= unset) while the matching column shows the arrow.
   *
   * @example
   *   toDataTableSorting(p, { fallbackVisual: { id: 'createdAt', desc: true } })
   */
  fallbackVisual?: { id: string, desc: boolean }
}

/**
 * Adapt a `usePaginatedQuery` result into the `DataTableServerSorting`
 * contract. DataTable will run in `manualSorting` mode — column-header
 * clicks call `onSortChange`, which `usePaginatedQuery` routes through to
 * the server input.
 *
 * @example
 *   const pagination = usePaginatedQuery(...)
 *   <DataTable
 *     serverPagination={toDataTablePagination(pagination)}
 *     serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
 *     {...}
 *   />
 */
export function toDataTableSorting<T>(
  p: PaginatedQueryResult<T>,
  options: ToDataTableSortingOptions = {},
): DataTableServerSorting {
  return {
    sortBy: p.sortBy,
    sortDir: p.sortDir,
    onSortChange: p.setSort,
    fallbackVisual: options.fallbackVisual,
  }
}

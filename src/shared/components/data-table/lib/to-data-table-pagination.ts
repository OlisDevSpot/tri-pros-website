import type { DataTableServerPagination } from '@/shared/components/data-table/types'
import type { PaginatedQueryResult } from '@/shared/dal/client/query/types'

/**
 * Adapt a `usePaginatedQuery` result into the `DataTableServerPagination`
 * contract. Converts 1-indexed `page` to 0-indexed `pageIndex` and merges
 * `isFetching || isPlaceholderData` into a single loading hint.
 *
 * @example
 *   const pagination = usePaginatedQuery(...)
 *   <DataTable serverPagination={toDataTablePagination(pagination)} {...} />
 */
export function toDataTablePagination<T>(p: PaginatedQueryResult<T>): DataTableServerPagination {
  return {
    pageIndex: p.page - 1,
    pageSize: p.pageSize,
    rowCount: p.total,
    onPageChange: nextIndex => p.setPage(nextIndex + 1),
    onPageSizeChange: p.setPageSize,
    pageSizeOptions: p.pageSizeOptions,
    isFetching: p.isFetching || p.isPlaceholderData,
  }
}

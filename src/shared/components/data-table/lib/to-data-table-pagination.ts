import type { DataTableServerPagination } from '@/shared/components/data-table/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/** 1-indexed page → TanStack's 0-indexed `pageIndex`; a table needs a page window, which the type enforces. */
export function toDataTablePagination<F extends FieldList, T extends ToolbarFilterId<F>>(query: DataViewQueryResult<unknown, F, T, 'page'>): DataTableServerPagination {
  const pageWindow = query.window
  return {
    pageIndex: pageWindow.page - 1,
    pageSize: pageWindow.pageSize,
    rowCount: query.total,
    onPageChange: nextIndex => pageWindow.setPage(nextIndex + 1),
    onPageSizeChange: pageWindow.setPageSize,
    pageSizeOptions: pageWindow.pageSizeOptions.length > 1 ? pageWindow.pageSizeOptions : undefined,
    isFetching: query.isFetching || query.isPlaceholderData,
    isError: query.isError,
    onRefresh: query.refresh,
  }
}

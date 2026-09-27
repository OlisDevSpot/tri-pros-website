import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

/**
 * One configuration of an entity table. Everything that shapes the query key lives here,
 * as a static constant, so the page's prefetch and the client's first query build the same key.
 */
export interface EntityTableView<TColumnKey extends string> {
  tableId: string
  query: PaginatedQueryConfig
  columns: readonly TColumnKey[]
}

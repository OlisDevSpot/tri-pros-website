import type { DataViewQueryConfig, DataViewWindow } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/**
 * One configuration of an entity table. Everything that shapes the query key lives here,
 * as a static constant, so the page's prefetch and the client's first query build the same key.
 */
export interface EntityTableView<TColumnKey extends string, F extends FieldList, T extends ToolbarFilterId<F> = ToolbarFilterId<F>> {
  tableId: string
  query: DataViewQueryConfig<F, T, Extract<DataViewWindow<F>, { kind: 'page' }>>
  columns: readonly TColumnKey[]
}

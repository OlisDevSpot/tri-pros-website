import type { CalendarViewType } from '@/shared/constants/enums'
import type { DateRangeFilterId, FieldList, FilterValues, SortState, ToolbarFilterId, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'

/** What limits the rows a data view gets: a table page, a calendar's date window, or the whole list (kanban). */
export type DataViewWindow<F extends FieldList>
  = | { kind: 'page', pageSize: number, pageSizeOptions: readonly number[] }
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number }
    | { kind: 'whole-list' }

export type DataViewWindowKind = DataViewWindow<FieldList>['kind']

/**
 * The static constant a data view shares with its page's prefetch. Everything that shapes the query
 * key lives here, so the server and the browser derive the same input from the same URL.
 */
export interface DataViewQueryConfig<
  F extends FieldList,
  T extends ToolbarFilterId<F> = ToolbarFilterId<F>,
  W extends DataViewWindow<F> = DataViewWindow<F>,
> {
  fields: F
  paramPrefix: string
  toolbar: readonly T[]
  defaultSort?: SortState<F>
  window: W
}

export interface DataViewInput<F extends FieldList> {
  pagination?: { limit: number, offset: number }
  sort?: SortState<F>
  search?: string
  filters?: FilterValues<F>
}

export interface FilterSortState<F extends FieldList> {
  sort: SortState<F> | undefined
  search: string | undefined
  filters: ToolbarFilterValues<F>
}

export type DataViewWindowState
  = | { kind: 'page', page: number, pageSize: number, pageSizeOptions: readonly number[], pagination: { limit: number, offset: number } }
    | { kind: 'date', anchor: string, view: CalendarViewType, range: { from: string, to: string }, cap: number, pagination: { limit: number, offset: number } }
    | { kind: 'whole-list' }

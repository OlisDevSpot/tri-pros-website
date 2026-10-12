import type { CalendarViewType } from '@/shared/constants/enums'
import type { DateRangeFilterId, FieldList, FilterValues, SortState, ToolbarFilterId, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'

/** What limits the rows a data view gets: a table page, a calendar's date window, the first rows of its order, or the whole list (kanban). */
export type DataViewWindow<F extends FieldList>
  = | { kind: 'page', pageSize: number, pageSizeOptions: readonly number[] }
    // `views`: the calendar views this data view allows; the first is its default.
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number, views: readonly [CalendarViewType, ...CalendarViewType[]] }
    // Nothing pages: the read's `total` still counts every matching row, so a callsite can say "5 of 23".
    | { kind: 'first', count: number }
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
  /** Filter values this data view always applies. Never read from the URL, never shown in the toolbar. */
  fixed?: FilterValues<F>
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
    | { kind: 'first', count: number, pagination: { limit: number, offset: number } }
    | { kind: 'whole-list' }

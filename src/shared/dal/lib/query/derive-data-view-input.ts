import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewInput, DataViewQueryConfig, DataViewWindowState, FilterSortState } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, FilterValues, SortDir, SortId, ToolbarFilterSpec, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'

import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { filterParserRegistry } from '@/shared/dal/lib/query/filter-parser-registry'
import { makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { businessDayWindow, businessMonthGridWindow, businessToday, businessWeekWindow, isCalendarDay, toInclusiveRange } from '@/shared/lib/business-time'

const SORT_DIRS = ['asc', 'desc'] as const

export function dataViewUrlKeys(paramPrefix: string) {
  return {
    ...makeQueryParsers(paramPrefix),
    anchorKey: `${paramPrefix}_d`,
    viewKey: `${paramPrefix}_v`,
  }
}

function sortIdsOf<F extends FieldList>(fields: F): SortId<F>[] {
  const fieldList: FieldList = fields
  return Object.keys(fieldList).filter(id => fieldList[id].sort === true) as SortId<F>[]
}

// Static options validate each member at parse time, so a bad member drops the same way on server and client.
function toolbarFilterParser(filter: ToolbarFilterSpec) {
  if ((filter.kind === 'multi-select' || filter.kind === 'select') && !('source' in filter.options)) {
    const values = filter.options.map(option => option.value)
    return filter.kind === 'multi-select'
      ? parseAsArrayOf(parseAsStringLiteral(values)).withDefault([] as string[])
      : parseAsStringLiteral(values).withDefault('')
  }
  return filterParserRegistry[filter.kind].parser
}

/** Parser map for `useQueryStates` (client) and `createLoader` (server), keyed by final URL key. */
export function makeDataViewParsers<F extends FieldList>(config: DataViewQueryConfig<F>): Record<string, unknown> {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const sortByParser = parseAsStringLiteral(sortIdsOf(config.fields))
  const sortDirParser = parseAsStringLiteral(SORT_DIRS)
  const parsers: Record<string, unknown> = {
    [keys.searchKey]: parseAsString.withDefault(''),
    [keys.sortByKey]: config.defaultSort ? sortByParser.withDefault(config.defaultSort.sortBy) : sortByParser,
    [keys.sortDirKey]: config.defaultSort ? sortDirParser.withDefault(config.defaultSort.sortDir) : sortDirParser,
  }
  // Widened once: derived id types are conditional, so they can't index the generic field list directly.
  const fields: FieldList = config.fields
  for (const id of config.toolbar) {
    parsers[keys.filterKey(id)] = toolbarFilterParser(fields[id].filter as ToolbarFilterSpec)
  }
  if (config.window.kind === 'page') {
    parsers[keys.pageKey] = parseAsInteger.withDefault(1)
    parsers[keys.pageSizeKey] = parseAsInteger.withDefault(config.window.pageSize)
  }
  if (config.window.kind === 'date') {
    parsers[keys.anchorKey] = parseAsString.withDefault('')
    parsers[keys.viewKey] = parseAsStringLiteral(config.window.views).withDefault(config.window.views[0])
  }
  return parsers
}

export function deriveFilterSortState<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): FilterSortState<F> {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const search = ((urlState[keys.searchKey] as string | null) ?? '').replace(/\0/g, '').trim() || undefined
  const sortBy = (urlState[keys.sortByKey] as SortId<F> | null) ?? config.defaultSort?.sortBy
  const sortDir = (urlState[keys.sortDirKey] as SortDir | null) ?? config.defaultSort?.sortDir ?? 'asc'

  const fields: FieldList = config.fields
  const filters: Record<string, unknown> = {}
  for (const id of config.toolbar) {
    const filter = fields[id].filter as ToolbarFilterSpec
    const { normalize } = filterParserRegistry[filter.kind] as { normalize: (raw: unknown) => unknown }
    const value = normalize(urlState[keys.filterKey(id)])
    if (value === undefined) {
      continue
    }
    // Runtime-option values arrive as plain strings; only the value schema can reject a malformed one.
    const parsed = filter.schema.safeParse(value)
    if (parsed.success) {
      filters[id] = parsed.data
    }
  }

  return {
    sort: sortBy ? { sortBy, sortDir } : undefined,
    search,
    filters: filters as ToolbarFilterValues<F>,
  }
}

function businessWindowOf(anchor: string, view: CalendarViewType): { from: string, to: string } {
  switch (view) {
    case 'today':
      return businessDayWindow(anchor)
    case 'week':
      return businessWeekWindow(anchor)
    case 'month':
      return businessMonthGridWindow(anchor)
  }
}

export function deriveDataViewWindow<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewWindowState {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const configWindow = config.window
  switch (configWindow.kind) {
    case 'page': {
      const page = Math.min(Math.max((urlState[keys.pageKey] as number | null) ?? 1, 1), MAX_PAGE)
      const requestedSize = (urlState[keys.pageSizeKey] as number | null) ?? configWindow.pageSize
      const pageSize = configWindow.pageSizeOptions.includes(requestedSize) ? requestedSize : configWindow.pageSize
      return { kind: 'page', page, pageSize, pageSizeOptions: configWindow.pageSizeOptions, pagination: { limit: pageSize, offset: (page - 1) * pageSize } }
    }
    case 'date': {
      const requestedAnchor = (urlState[keys.anchorKey] as string | null) ?? ''
      const anchor = isCalendarDay(requestedAnchor) ? requestedAnchor : businessToday()
      const allowedViews: readonly CalendarViewType[] = configWindow.views
      const requestedView = urlState[keys.viewKey] as CalendarViewType | null | undefined
      const view = requestedView && allowedViews.includes(requestedView) ? requestedView : configWindow.views[0]
      const range = toInclusiveRange(businessWindowOf(anchor, view))
      return { kind: 'date', anchor, view, range, cap: configWindow.cap, pagination: { limit: configWindow.cap, offset: 0 } }
    }
    case 'whole-list':
      return { kind: 'whole-list' }
  }
}

export function toDataViewInput<F extends FieldList>(filterSort: FilterSortState<F>, windowState: DataViewWindowState, config: DataViewQueryConfig<F>): DataViewInput<F> {
  const filters: Record<string, unknown> = { ...filterSort.filters }
  if (config.window.kind === 'date' && windowState.kind === 'date') {
    filters[config.window.field] = windowState.range
  }
  return {
    pagination: windowState.kind === 'whole-list' ? undefined : windowState.pagination,
    sort: filterSort.sort,
    search: filterSort.search,
    filters: Object.keys(filters).length > 0 ? filters as FilterValues<F> : undefined,
  }
}

/** The single source of truth from URL state to read input; the server loader and the client hook both use it. */
export function deriveDataViewInput<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewInput<F> {
  return toDataViewInput(deriveFilterSortState(urlState, config), deriveDataViewWindow(urlState, config), config)
}

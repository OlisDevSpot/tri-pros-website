'use client'

import type { UseQueryOptions } from '@tanstack/react-query'
import type { DecorateQueryProcedure, inferInput } from '@trpc/tanstack-react-query'

import type { CalendarViewType } from '@/shared/constants/enums'
import type { OptionSourceRow } from '@/shared/dal/client/constants/option-source-reads'
import type { DataViewFilterSort, DataViewQueryResult, DataViewRowOf, DataViewWindowControls } from '@/shared/dal/client/lib/types'
import type { OptionSource } from '@/shared/dal/lib/query/constants'
import type { DataViewInput, DataViewQueryConfig, DataViewWindow } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, FilterOption, SortDir, ToolbarFilterId, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'

import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'

import { OPTION_SOURCE_READS } from '@/shared/dal/client/constants/option-source-reads'
import { usePrefetchQueries } from '@/shared/dal/client/hooks/use-prefetch-queries'
import { adjacentDataViewWindows } from '@/shared/dal/lib/query/adjacent-windows'
import { dataViewUrlKeys, deriveDataViewWindow, deriveFilterSortState, makeDataViewParsers, toDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'
import { useTRPC } from '@/trpc/helpers'

type AnyQueryProcedure = DecorateQueryProcedure<any>

// Resolves to `never` (a compile error at the call site) when the procedure can't accept the derived input plus `extra`.
type AcceptsDataViewInput<TProcedure extends AnyQueryProcedure, TInput> = TInput extends inferInput<TProcedure> ? unknown : never

interface UseDataViewQueryOptions {
  enabled?: boolean
}

/** Toolbar fields whose choices load at runtime, with the source each reads. */
function runtimeOptionFields(fields: FieldList, toolbar: readonly string[]): { id: string, source: OptionSource }[] {
  return toolbar.flatMap((id) => {
    const filter = fields[id].filter as ToolbarFilterSpec
    return (filter.kind === 'multi-select' || filter.kind === 'select') && 'source' in filter.options
      ? [{ id, source: filter.options.source }]
      : []
  })
}

/**
 * One hook per data view: URL state → the same input the page prefetched → rows, plain setters and
 * the toolbar's runtime options. Call it once in the view (or entity-table hook) and pass the result down.
 */
export function useDataViewQuery<
  TProcedure extends AnyQueryProcedure,
  F extends FieldList,
  T extends ToolbarFilterId<F>,
  W extends DataViewWindow<F>,
  TExtra extends object,
>(
  procedure: TProcedure & AcceptsDataViewInput<TProcedure, DataViewInput<F> & TExtra>,
  extra: TExtra,
  config: DataViewQueryConfig<F, T, W>,
  options: UseDataViewQueryOptions = {},
): DataViewQueryResult<DataViewRowOf<TProcedure>, F, T, W['kind']> {
  const { enabled = true } = options
  const qc = useQueryClient()
  const trpc = useTRPC()
  const ability = useAbility()
  const keys = useMemo(() => dataViewUrlKeys(config.paramPrefix), [config.paramPrefix])
  const parsers = useMemo(() => makeDataViewParsers(config), [config])

  // useQueryStates' generic can't express a parser map built at runtime; the derivation narrows values.
  const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
  const state = urlState as Record<string, unknown>

  // The toolbar's search box debounces before it commits, so the URL value is already the settled search.
  const search = (state[keys.searchKey] as string | null) ?? ''

  const filterSort = useMemo(() => deriveFilterSortState(state, config), [state, config])
  const windowState = useMemo(() => deriveDataViewWindow(state, config), [state, config])

  const extraKey = JSON.stringify(extra)
  const queryInput = useMemo(
    () => ({ ...toDataViewInput(filterSort, windowState, config), ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra is deep-keyed via extraKey so an inline literal doesn't refetch
    [filterSort, windowState, config, extraKey],
  )

  const anyProcedure = procedure as AnyQueryProcedure
  const baseOptions = anyProcedure.queryOptions(queryInput)

  useEffect(() => {
    checkHydrationParity(baseOptions.queryKey as readonly unknown[])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later keys are client-driven refetches, not hydration targets
  }, [])

  const result = useQuery({ ...baseOptions, placeholderData: keepPreviousData, enabled })
  const data = result.data as PaginatedResult<DataViewRowOf<TProcedure>> | undefined
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  // Only the sources this toolbar shows are read, and only by viewers the read would accept.
  const optionFields = useMemo(() => runtimeOptionFields(config.fields, config.toolbar), [config.fields, config.toolbar])
  const loadedOptions = useQueries({
    queries: optionFields.map(({ source }) => ({
      // The registry's type guarantees every read returns option rows; the union of their exact types can't spread here.
      ...(OPTION_SOURCE_READS[source].queryOptions(trpc) as UseQueryOptions<readonly OptionSourceRow[]>),
      enabled: OPTION_SOURCE_READS[source].canRead(ability),
    })),
    combine: results => results.map(r => r.data?.map((row): FilterOption => ({ value: row.id, label: row.name }))),
  })
  const runtimeOptions = useMemo(
    (): Partial<Record<string, readonly FilterOption[]>> => Object.fromEntries(optionFields.flatMap(({ id }, i) => (loadedOptions[i] ? [[id, loadedOptions[i]]] : []))),
    [optionFields, loadedOptions],
  )

  const refresh = useCallback(async () => {
    await qc.invalidateQueries(anyProcedure.queryFilter())
  }, [qc, anyProcedure])

  const resetsPage = config.window.kind === 'page'

  const setFilter = useCallback((id: string, value: unknown) => {
    void setUrlState(
      { [keys.filterKey(id)]: value ?? null, ...(resetsPage ? { [keys.pageKey]: null } : {}) } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const setSearch = useCallback((value: string) => {
    void setUrlState(
      { [keys.searchKey]: value || null, ...(resetsPage ? { [keys.pageKey]: null } : {}) } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const setSort = useCallback((sortBy: string | undefined, sortDir?: SortDir) => {
    void setUrlState(
      {
        [keys.sortByKey]: sortBy ?? null,
        [keys.sortDirKey]: sortBy ? (sortDir ?? 'asc') : null,
        ...(resetsPage ? { [keys.pageKey]: null } : {}),
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const clearFilters = useCallback(() => {
    const reset: Record<string, null> = { [keys.searchKey]: null, [keys.sortByKey]: null, [keys.sortDirKey]: null }
    for (const id of config.toolbar) {
      reset[keys.filterKey(id)] = null
    }
    if (resetsPage) {
      reset[keys.pageKey] = null
    }
    void setUrlState(reset as never, { history: 'replace' })
  }, [setUrlState, keys, config.toolbar, resetsPage])

  const setPage = useCallback((page: number) => {
    void setUrlState({ [keys.pageKey]: Math.max(page, 1) } as never, { history: 'push' })
  }, [setUrlState, keys])

  const setPageSize = useCallback((pageSize: number) => {
    if (config.window.kind !== 'page' || !config.window.pageSizeOptions.includes(pageSize)) {
      return
    }
    void setUrlState({ [keys.pageSizeKey]: pageSize, [keys.pageKey]: null } as never, { history: 'replace' })
  }, [setUrlState, keys, config.window])

  const setAnchor = useCallback((calendarDay: string | undefined) => {
    void setUrlState({ [keys.anchorKey]: calendarDay ?? null } as never, { history: 'push' })
  }, [setUrlState, keys])

  const setView = useCallback((view: CalendarViewType) => {
    void setUrlState({ [keys.viewKey]: view } as never, { history: 'push' })
  }, [setUrlState, keys])

  const pageCount = windowState.kind === 'page' && total > 0 ? Math.ceil(total / windowState.pageSize) : 0

  // Page past the end (rows deleted, filter narrowed elsewhere): clamp; an empty result keeps its own empty state.
  useEffect(() => {
    if (windowState.kind === 'page' && data && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [windowState, data, pageCount, keys, setUrlState])

  const adjacentWindows = useMemo(() => adjacentDataViewWindows(state, config), [state, config])
  const adjacentQueries = adjacentWindows
    .filter(adjacent => adjacent.kind !== 'page' || adjacent.pagination.offset < total)
    .map(adjacent => anyProcedure.queryOptions({ ...toDataViewInput(filterSort, adjacent, config), ...extra }))
  usePrefetchQueries(adjacentQueries, result.isSuccess && !result.isPlaceholderData && !result.isFetching)

  const windowControls = useMemo((): DataViewWindowControls => {
    switch (windowState.kind) {
      case 'page':
        return { kind: 'page', page: windowState.page, pageSize: windowState.pageSize, pageSizeOptions: windowState.pageSizeOptions, pageCount, setPage, setPageSize }
      case 'date':
        return { kind: 'date', anchor: windowState.anchor, view: windowState.view, range: windowState.range, cap: windowState.cap, setAnchor, setView }
      case 'whole-list':
        return { kind: 'whole-list' }
    }
  }, [windowState, pageCount, setPage, setPageSize, setAnchor, setView])

  const filterSortControls = useMemo((): DataViewFilterSort<F, T> => ({
    fields: config.fields,
    toolbar: config.toolbar,
    filters: filterSort.filters as DataViewFilterSort<F, T>['filters'],
    options: runtimeOptions as DataViewFilterSort<F, T>['options'],
    activeFilterCount: Object.keys(filterSort.filters).length,
    setFilter: setFilter as DataViewFilterSort<F, T>['setFilter'],
    clearFilters,
    search,
    setSearch,
    sortBy: filterSort.sort?.sortBy,
    sortDir: filterSort.sort?.sortDir,
    setSort: setSort as DataViewFilterSort<F, T>['setSort'],
  }), [config.fields, config.toolbar, filterSort, runtimeOptions, setFilter, clearFilters, search, setSearch, setSort])

  return {
    rows,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    refresh,
    filterSort: filterSortControls,
    window: windowControls as DataViewWindowControls<W['kind']>,
  }
}

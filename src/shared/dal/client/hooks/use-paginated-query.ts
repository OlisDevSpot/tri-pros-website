'use client'

import type { FilterValue, PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { PaginatedQueryConfig, PaginatedQueryInput } from '@/shared/dal/lib/query/derive-paginated-query-state'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'

import { hashKey, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react'

import { EMPTY_DATA_VIEW_READ } from '@/shared/dal/client/constants/empty-data-view-read'
import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'
import { useServerPrefetchGuard } from '@/shared/dal/client/hooks/use-server-prefetch-guard'
import { DEFAULT_PAGE_SIZE } from '@/shared/dal/lib/query/constants'
import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'
import { assertNoReservedFilterIds, makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'

// `any` satisfies contravariance against tRPC's overloaded `queryOptions` signature so callers
// can pass `trpc.x.y.queryOptions` directly; `_TRow` is a phantom that flows to `PaginatedQueryResult<TRow>`.
type PaginatedQueryFactory<TInput, _TRow> = (input: TInput, ...rest: any[]) => any

export type { PaginatedQueryInput }

interface UsePaginatedQueryOptions extends PaginatedQueryConfig {
  /** Prefetch the next page when the current page resolves. */
  prefetchNextPage?: boolean
}

/**
 * One hook for page, size, search, sort AND filters so "reset page on any change" is enforced in one place.
 * `queryOptionsFactory` must be the tRPC proxy's `queryOptions` reference (stable identity).
 */
export function usePaginatedQuery<TExtra extends object, TRow>(
  queryOptionsFactory: PaginatedQueryFactory<PaginatedQueryInput & TExtra, TRow>,
  extra: TExtra,
  options: UsePaginatedQueryOptions = {},
): PaginatedQueryResult<TRow> {
  const {
    paramPrefix,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions,
    prefetchNextPage = true,
    defaultSort,
    filters: filterDefinitions = [],
  } = options

  const qc = useQueryClient()
  const keys = useMemo(() => makeQueryParsers(paramPrefix), [paramPrefix])

  useEffect(() => {
    assertNoReservedFilterIds(filterDefinitions.map(f => f.id))
  }, [filterDefinitions])

  // Deep-keyed so inline-literal options don't churn config identity every render.
  const pageSizeOptionsKey = JSON.stringify(pageSizeOptions ?? null)
  const config = useMemo<PaginatedQueryConfig>(() => ({
    paramPrefix,
    pageSize: initialPageSize,
    pageSizeOptions,
    defaultSort,
    filters: filterDefinitions,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageSizeOptions deep-keyed via pageSizeOptionsKey; defaultSort by its two fields
  }), [paramPrefix, initialPageSize, pageSizeOptionsKey, defaultSort?.sortBy, defaultSort?.sortDir, filterDefinitions])

  const parsers = useMemo(() => makePaginatedParsers(config), [config])

  // useQueryStates' inferred generic can't express our dynamic parser map; narrowed by known key names.
  const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
  const stateAny = urlState as Record<string, unknown>
  const isPending = useIsDataViewPending()
  // Rows stay on the last URL state whose data is in while the next one loads (covers Back/Forward too).
  const shownStateAny = useDeferredValue(stateAny)

  // The toolbar's search box debounces before it commits, so the URL value is already the settled search.
  const search = (stateAny[keys.searchKey] as string) ?? ''

  const derived = useMemo(() => derivePaginatedQueryState(stateAny, config), [stateAny, config])
  const deferredDerived = useMemo(() => derivePaginatedQueryState(shownStateAny, config), [shownStateAny, config])
  const { page, pageSize: effectivePageSize, sortBy, sortDir, filters: filterValues } = derived

  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter(v => v !== undefined).length,
    [filterValues],
  )

  // Deep-keyed so a fresh-ref-each-render `extra` doesn't re-trigger the prefetch effect.
  const extraKey = JSON.stringify(extra)

  const requestedInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...derived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [derived, extraKey],
  )
  const requestedOptions = queryOptionsFactory(requestedInput)
  // The deferred state lags one render behind every change, and rapid steps keep discarding the render that would
  // catch up; a key whose rows are already cached reads at once, so only a key still loading shows the old rows.
  const shownDerived = qc.getQueryData(requestedOptions.queryKey) !== undefined ? derived : deferredDerived
  const shownInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...shownDerived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [shownDerived, extraKey],
  )
  const baseOptions = queryOptionsFactory(shownInput)
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(baseOptions.queryKey)

  // queryKey[0] is the procedure path, so invalidating by it hits every cached page/filter/sort
  // of this table (incl. the prefetched next page); relies on the repo's no-`keyPrefix` invariant.
  const procedureKey = baseOptions.queryKey[0] as readonly string[]
  const procedureKeyString = JSON.stringify(procedureKey)
  const refresh = useCallback(
    async () => {
      await qc.invalidateQueries({ queryKey: [procedureKey] })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- procedureKey deep-keyed via procedureKeyString (its value is stable across renders)
    [qc, procedureKeyString],
  )

  // Dev-only: detect server-prefetch key drift (wasted hydration).
  const baseQueryKey = baseOptions.queryKey as readonly unknown[]
  useServerPrefetchGuard(baseOptions.queryKey, !isPending)
  useEffect(() => {
    if (!isPending) {
      checkHydrationParity(baseQueryKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later key changes are client-driven refetches, not hydration targets
  }, [])

  // Suspends until the shown key's rows are in; inside a DataViewBoundary fallback it reads an empty page instead.
  const read = useSuspenseQuery(isPending ? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions) : baseOptions)
  const data = read.data as PaginatedResult<TRow>
  const isFetching = !isPending && read.isFetching
  const total = data.total
  const rows = data.rows
  const pageCount = total > 0 ? Math.ceil(total / effectivePageSize) : 0

  // Page-beyond-total clamp; skipped at total=0 because the empty state has its own UX.
  useEffect(() => {
    if (!isPending && !isStale && pageCount > 0 && page > pageCount) {
      void setUrlState(
        { [keys.pageKey]: pageCount } as never,
        { history: 'replace' },
      )
    }
  }, [isPending, isStale, page, pageCount, keys.pageKey, setUrlState])

  useEffect(() => {
    if (!prefetchNextPage || isPending || isStale || isFetching) {
      return
    }
    const shownOffset = shownDerived.input.pagination.offset
    const shownPageSize = shownDerived.pageSize
    const hasNext = shownOffset + shownPageSize < data.total
    if (!hasNext) {
      return
    }
    const nextOptions = queryOptionsFactory({
      ...shownInput,
      pagination: { limit: shownPageSize, offset: shownOffset + shownPageSize },
    })
    void qc.prefetchQuery(nextOptions)
  }, [prefetchNextPage, isPending, isStale, isFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc])

  const setPage = useCallback((next: number) => {
    void setUrlState(
      { [keys.pageKey]: Math.max(next, 1) } as never,
      { history: 'push' },
    )
  }, [setUrlState, keys.pageKey])

  const setPageSize = useCallback((next: number) => {
    if (!pageSizeOptions || !pageSizeOptions.includes(next)) {
      return
    }
    void setUrlState(
      {
        [keys.pageSizeKey]: next,
        [keys.pageKey]: null, // reset to 1
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys.pageSizeKey, keys.pageKey, pageSizeOptions])

  const setSearch = useCallback((value: string) => {
    void setUrlState(
      {
        [keys.searchKey]: value || null,
        [keys.pageKey]: null,
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys.searchKey, keys.pageKey])

  const setSort = useCallback((nextSortBy: string | undefined, nextSortDir?: 'asc' | 'desc') => {
    void setUrlState(
      {
        [keys.sortByKey]: nextSortBy ?? null,
        [keys.sortDirKey]: nextSortBy ? (nextSortDir ?? 'asc') : null,
        [keys.pageKey]: null,
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys.sortByKey, keys.sortDirKey, keys.pageKey])

  const setFilter = useCallback((id: string, value: FilterValue) => {
    const filterUrlKey = keys.filterKey(id)
    void setUrlState(
      {
        [filterUrlKey]: value === undefined ? null : value,
        [keys.pageKey]: null,
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys])

  const clearFilters = useCallback(() => {
    const reset: Record<string, null> = {
      [keys.pageKey]: null,
      [keys.searchKey]: null,
      [keys.sortByKey]: null,
      [keys.sortDirKey]: null,
    }
    for (const def of filterDefinitions) {
      reset[keys.filterKey(def.id)] = null
    }
    void setUrlState(reset as never, { history: 'replace' })
  }, [setUrlState, keys, filterDefinitions])

  return {
    rows,
    total,
    page,
    pageSize: effectivePageSize,
    pageSizeOptions,
    pageCount,
    setPage,
    setPageSize,
    search,
    setSearch,
    sortBy,
    sortDir,
    setSort,
    filterDefinitions,
    filters: filterValues,
    setFilter,
    clearFilters,
    activeFilterCount,
    isPending,
    isStale,
    isFetching,
    refresh,
  }
}

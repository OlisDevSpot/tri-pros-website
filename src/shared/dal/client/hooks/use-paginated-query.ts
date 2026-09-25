'use client'

import type { FilterValue, PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { PaginatedQueryConfig, PaginatedQueryInput } from '@/shared/dal/lib/query/derive-paginated-query-state'
import type { PaginatedResult } from '@/shared/dal/server/lib/query/output'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'

import { DEFAULT_DEBOUNCE_MS } from '@/shared/dal/client/lib/constants'
import { DEFAULT_PAGE_SIZE } from '@/shared/dal/lib/query/constants'
import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'
import { assertNoReservedFilterIds, makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'

// `any` satisfies contravariance against tRPC's overloaded `queryOptions` signature so callers
// can pass `trpc.x.y.queryOptions` directly; `_TRow` is a phantom that flows to `PaginatedQueryResult<TRow>`.
type PaginatedQueryFactory<TInput, _TRow> = (input: TInput, ...rest: any[]) => any

export type { PaginatedQueryInput }

interface UsePaginatedQueryOptions extends PaginatedQueryConfig {
  /** Search debounce in ms. */
  searchDebounceMs?: number
  /** Disable the query without losing URL state. */
  enabled?: boolean
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
    searchDebounceMs = DEFAULT_DEBOUNCE_MS,
    enabled = true,
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

  const searchInput = (stateAny[keys.searchKey] as string) ?? ''
  const searchDebounced = useDebounce(searchInput.trim(), searchDebounceMs)

  const derived = useMemo(
    () => derivePaginatedQueryState(
      { ...stateAny, [keys.searchKey]: searchDebounced },
      config,
    ),
    [stateAny, keys.searchKey, searchDebounced, config],
  )
  const { page, pageSize: effectivePageSize, sortBy, sortDir, filters: filterValues } = derived
  const offset = derived.input.pagination.offset

  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter(v => v !== undefined).length,
    [filterValues],
  )

  // Deep-keyed so a fresh-ref-each-render `extra` doesn't re-trigger the prefetch effect.
  const extraKey = JSON.stringify(extra)

  const queryInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...derived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [derived, extraKey],
  )

  const baseOptions = queryOptionsFactory(queryInput)

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
  useEffect(() => {
    checkHydrationParity(baseQueryKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later key changes are client-driven refetches, not hydration targets
  }, [])

  const result = useQuery({
    ...baseOptions,
    placeholderData: keepPreviousData,
    enabled,
  })
  const { isLoading, isFetching, isPlaceholderData, isError, error } = result
  const data = result.data as PaginatedResult<TRow> | undefined

  const total = data?.total ?? 0
  const rows = data?.rows ?? []
  const pageCount = total > 0 ? Math.ceil(total / effectivePageSize) : 0

  // Page-beyond-total clamp; skipped at total=0 because the empty state has its own UX.
  useEffect(() => {
    if (data && pageCount > 0 && page > pageCount) {
      void setUrlState(
        { [keys.pageKey]: pageCount } as never,
        { history: 'replace' },
      )
    }
  }, [data, page, pageCount, keys.pageKey, setUrlState])

  useEffect(() => {
    if (!prefetchNextPage || !data) {
      return
    }
    const hasNext = offset + effectivePageSize < data.total
    if (!hasNext) {
      return
    }
    const nextOptions = queryOptionsFactory({
      ...queryInput,
      pagination: { limit: effectivePageSize, offset: offset + effectivePageSize },
    })
    void qc.prefetchQuery(nextOptions)
  }, [prefetchNextPage, data, offset, effectivePageSize, queryInput, queryOptionsFactory, qc])

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

  const setSearchInput = useCallback((value: string) => {
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
    searchInput,
    setSearchInput,
    searchDebounced,
    sortBy,
    sortDir,
    setSort,
    filterDefinitions,
    filters: filterValues,
    setFilter,
    clearFilters,
    activeFilterCount,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refresh,
  }
}

'use client'

import type { FilterDefinition, FilterState, FilterValue, PaginatedQueryResult } from '@/shared/dal/client/query/types'
import type { PaginatedResult } from '@/shared/dal/server/query/output'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'

import { filterParserRegistry } from '@/shared/dal/client/query/filter-parser-registry'
import { assertNoReservedFilterIds, makeQueryParsers } from '@/shared/dal/client/query/url-state'
import { useDebounce } from '@/shared/hooks/use-debounce'

/**
 * Factory signature matching tRPC's overloaded `queryOptions(input, opts?)`.
 * Return type is left as `any` (the resulting blob is just spread into
 * `useQuery`); the explicit `TRow` generic gives callers type-safety on
 * `result.rows`. The `...rest: any[]` tail absorbs tRPC's optional second arg
 * so callers can pass `trpc.x.y.queryOptions` directly without wrapping.
 *
 * The `_TRow` phantom type carries the row shape through to
 * `PaginatedQueryResult<TRow>` even though the factory body doesn't reference it.
 */
// `any` is required to satisfy contravariance against tRPC's overloaded
// queryOptions signature (first overload requires `opts: DefinedTRPCQueryOptionsIn<...>`).
// `_TRow` is a phantom type that flows through to PaginatedQueryResult<TRow>.
type PaginatedQueryFactory<TInput, _TRow> = (input: TInput, ...rest: any[]) => any

/**
 * The shape sent to the server. Matches `paginatedQueryInput()` output.
 */
interface PaginatedQueryInput {
  pagination: { limit: number, offset: number }
  sort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  search?: string
  filters?: Record<string, FilterValue>
}

interface UsePaginatedQueryOptions {
  /** Distinct URL key prefix when multiple paginated views share a route. */
  paramPrefix?: string
  /** Default page size; used when no URL value is present. */
  pageSize?: number
  /** Allowed page sizes. When omitted, `setPageSize` is a no-op (no UI). */
  pageSizeOptions?: readonly number[]
  /** Search debounce in ms. */
  searchDebounceMs?: number
  /** Disable the query without losing URL state. */
  enabled?: boolean
  /** Prefetch the next page when the current page resolves. */
  prefetchNextPage?: boolean
  /** Initial sort applied when no URL state is present. */
  defaultSort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  /** Filter definitions — each becomes a URL key + filter UI slot. */
  filters?: readonly FilterDefinition[]
}

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_DEBOUNCE_MS = 250

/**
 * Generic discrete (offset/limit) paginated query primitive — the source of
 * truth for any data view that hits a paginated tRPC procedure.
 *
 * Bundles page state, page-size, debounced search, sort, AND filters into a
 * single hook so the "reset page on filter/sort/search/size change" coupling
 * is enforced. UI containers (DataTable, Kanban, etc.) consume the returned
 * `PaginatedQueryResult` via thin adapters; the `<QueryToolbar>` compound
 * renders search/filter/sort/page-size UI from this same state.
 *
 * @param queryOptionsFactory  Function turning a paginated input into tRPC
 *   `queryOptions(...)` output (or any TanStack-compatible options object).
 *   Must be the tRPC proxy's `queryOptions` reference, which is stable.
 * @param extra  Procedure-specific top-level inputs merged with the
 *   paginated query input (e.g. `{ id: leadSourceId }`).
 * @param options  Hook-level configuration.
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

  // -- Reserved-key guard (dev only) ---------------------------------------
  useEffect(() => {
    assertNoReservedFilterIds(filterDefinitions.map(f => f.id))
  }, [filterDefinitions])

  // -- Build parsers map dynamically ----------------------------------------
  // Parsers cover: page, search, sortBy, sortDir, pageSize, plus one per
  // filter definition.
  const parsers = useMemo(() => {
    const base: Record<string, unknown> = {
      [keys.pageKey]: parseAsInteger.withDefault(1),
      [keys.searchKey]: parseAsString.withDefault(''),
      [keys.sortByKey]: parseAsString.withDefault(defaultSort?.sortBy ?? ''),
      [keys.sortDirKey]: parseAsStringEnum(['asc', 'desc']).withDefault(defaultSort?.sortDir ?? 'asc'),
      [keys.pageSizeKey]: parseAsInteger.withDefault(initialPageSize),
    }
    for (const def of filterDefinitions) {
      base[keys.filterKey(def.id)] = filterParserRegistry[def.type].parser
    }
    return base
  }, [keys, defaultSort?.sortBy, defaultSort?.sortDir, initialPageSize, filterDefinitions])

  // Cast required: useQueryStates infers a precise generic from the parsers
  // map but our dynamic shape can't express that statically. We narrow at
  // the boundary by reading values via known key names.
  const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
  const stateAny = urlState as Record<string, unknown>

  // -- Read state values ----------------------------------------------------
  const page = Math.max((stateAny[keys.pageKey] as number) ?? 1, 1)
  const searchInput = (stateAny[keys.searchKey] as string) ?? ''
  const sortByRaw = (stateAny[keys.sortByKey] as string) ?? ''
  const sortDirRaw = (stateAny[keys.sortDirKey] as 'asc' | 'desc') ?? 'asc'

  const sortBy = sortByRaw || undefined
  const sortDir = sortBy ? sortDirRaw : undefined

  const pageSizeRaw = (stateAny[keys.pageSizeKey] as number) ?? initialPageSize
  const effectivePageSize = pageSizeOptions
    ? (pageSizeOptions.includes(pageSizeRaw) ? pageSizeRaw : initialPageSize)
    : initialPageSize

  const searchDebounced = useDebounce(searchInput.trim(), searchDebounceMs)
  const offset = (page - 1) * effectivePageSize

  // -- Read filter values + normalize --------------------------------------
  const filterValues: FilterState = useMemo(() => {
    const result: FilterState = {}
    for (const def of filterDefinitions) {
      const raw = stateAny[keys.filterKey(def.id)]
      const spec = filterParserRegistry[def.type] as { normalize: (v: unknown) => FilterValue }
      result[def.id] = spec.normalize(raw)
    }
    return result
  }, [filterDefinitions, keys, stateAny])

  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter(v => v !== undefined).length,
    [filterValues],
  )

  // -- Build server input ---------------------------------------------------
  // Stable-stringify `extra` so a fresh-ref-each-render `extra` doesn't
  // re-trigger the prefetch effect or invalidate downstream memos.
  const extraKey = JSON.stringify(extra)

  const queryInput = useMemo<PaginatedQueryInput & TExtra>(() => {
    const activeFilters: Record<string, FilterValue> = {}
    for (const id of Object.keys(filterValues)) {
      const v = filterValues[id]
      if (v !== undefined) {
        activeFilters[id] = v
      }
    }
    return {
      pagination: { limit: effectivePageSize, offset },
      sort: sortBy ? { sortBy, sortDir: sortDir ?? 'asc' } : undefined,
      search: searchDebounced || undefined,
      filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
      ...extra,
    } as PaginatedQueryInput & TExtra
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
  }, [effectivePageSize, offset, searchDebounced, sortBy, sortDir, filterValues, extraKey])

  const baseOptions = queryOptionsFactory(queryInput)

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

  // -- Page-beyond-total clamp ---------------------------------------------
  // After data lands, if the URL says we're past the last page (e.g. user
  // deleted records or applied a filter that shrunk total), redirect to the
  // last available page. Skip when total=0 (no data state has its own UX).
  useEffect(() => {
    if (data && pageCount > 0 && page > pageCount) {
      void setUrlState(
        { [keys.pageKey]: pageCount } as never,
        { history: 'replace' },
      )
    }
  }, [data, page, pageCount, keys.pageKey, setUrlState])

  // -- Prefetch next page --------------------------------------------------
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

  // -- Setters --------------------------------------------------------------
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
  }
}

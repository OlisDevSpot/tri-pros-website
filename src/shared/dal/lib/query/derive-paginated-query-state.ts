import type { FilterDefinition, FilterState, FilterValue } from '@/shared/dal/client/lib/types'

import { parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs/server'

import { DEFAULT_PAGE_SIZE } from '@/shared/dal/lib/query/constants'
import { filterParserRegistry } from '@/shared/dal/lib/query/filter-parser-registry'
import { makeQueryParsers } from '@/shared/dal/lib/query/url-state'

/**
 * Static, serializable slice of a paginated view's configuration — the part
 * shared by the client hook (`usePaginatedQuery`) and the server loader
 * (`loadPaginatedQueryInput`). One exported config object per table is the
 * contract that guarantees the server-prefetched query key matches the
 * client's first-mount key.
 */
export interface PaginatedQueryConfig {
  paramPrefix?: string
  pageSize?: number
  pageSizeOptions?: readonly number[]
  defaultSort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  filters?: readonly FilterDefinition[]
}

/** The shape sent to the server. Matches `paginatedQueryInput()` output. */
export interface PaginatedQueryInput {
  pagination: { limit: number, offset: number }
  sort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  search?: string
  filters?: Record<string, FilterValue>
}

/** Derived state: the tRPC input plus the display values the hook surfaces. */
export interface PaginatedQueryState {
  input: PaginatedQueryInput
  page: number
  pageSize: number
  sortBy: string | undefined
  sortDir: 'asc' | 'desc' | undefined
  /** ALL filter ids, normalized (`undefined` = inactive). */
  filters: FilterState
}

/**
 * Parser map for `useQueryStates` (client) and `createLoader` (server).
 * Keys are the FINAL URL keys (prefix already applied by `makeQueryParsers`).
 */
export function makePaginatedParsers(config: PaginatedQueryConfig): Record<string, unknown> {
  const keys = makeQueryParsers(config.paramPrefix)
  const parsers: Record<string, unknown> = {
    [keys.pageKey]: parseAsInteger.withDefault(1),
    [keys.searchKey]: parseAsString.withDefault(''),
    [keys.sortByKey]: parseAsString.withDefault(config.defaultSort?.sortBy ?? ''),
    [keys.sortDirKey]: parseAsStringEnum(['asc', 'desc']).withDefault(config.defaultSort?.sortDir ?? 'asc'),
    [keys.pageSizeKey]: parseAsInteger.withDefault(config.pageSize ?? DEFAULT_PAGE_SIZE),
  }
  for (const def of config.filters ?? []) {
    parsers[keys.filterKey(def.id)] = filterParserRegistry[def.type].parser
  }
  return parsers
}

/**
 * Pure input assembly — the single source of truth for turning parsed URL
 * state into the tRPC query input. Both the client hook and the server
 * loader call this; any divergence between them is a cache-miss bug, so
 * NEVER inline these coercions elsewhere. Rules preserved verbatim from the
 * original hook implementation: page floor, pageSize allowlist, sortDir
 * suppression without sortBy, search trim + empty→undefined, per-type
 * filter-active normalization, filters omitted entirely when none active.
 */
export function derivePaginatedQueryState(
  urlState: Record<string, unknown>,
  config: PaginatedQueryConfig,
): PaginatedQueryState {
  const keys = makeQueryParsers(config.paramPrefix)
  const initialPageSize = config.pageSize ?? DEFAULT_PAGE_SIZE

  const page = Math.max((urlState[keys.pageKey] as number) ?? 1, 1)
  const searchTrimmed = ((urlState[keys.searchKey] as string) ?? '').trim()
  const sortByRaw = (urlState[keys.sortByKey] as string) ?? ''
  const sortDirRaw = (urlState[keys.sortDirKey] as 'asc' | 'desc') ?? 'asc'
  const sortBy = sortByRaw || undefined
  const sortDir = sortBy ? sortDirRaw : undefined

  const pageSizeRaw = (urlState[keys.pageSizeKey] as number) ?? initialPageSize
  const pageSize = config.pageSizeOptions
    ? (config.pageSizeOptions.includes(pageSizeRaw) ? pageSizeRaw : initialPageSize)
    : initialPageSize
  const offset = (page - 1) * pageSize

  const filters: FilterState = {}
  const activeFilters: Record<string, FilterValue> = {}
  for (const def of config.filters ?? []) {
    const spec = filterParserRegistry[def.type] as { normalize: (v: unknown) => FilterValue }
    const value = spec.normalize(urlState[keys.filterKey(def.id)])
    filters[def.id] = value
    if (value !== undefined) {
      activeFilters[def.id] = value
    }
  }

  return {
    input: {
      pagination: { limit: pageSize, offset },
      sort: sortBy ? { sortBy, sortDir: sortDir ?? 'asc' } : undefined,
      search: searchTrimmed || undefined,
      filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
    },
    page,
    pageSize,
    sortBy,
    sortDir,
    filters,
  }
}

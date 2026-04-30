/**
 * Reserved URL key suffixes the toolkit owns. Filter ids must avoid these.
 */
const RESERVED_SUFFIXES = ['p', 'q', 'sort', 'dir', 'ps'] as const

/**
 * Build per-instance URL key suffixes for a paginated view. When two paginated
 * surfaces share a route (e.g. lead-source customers + all customers), pass
 * distinct prefixes so their URL state doesn't collide.
 *
 * Without prefix: `?p`, `?q`, `?sort`, `?dir`, `?ps`, `?<filter-id>`
 * With prefix `'src'`: `?src_p`, `?src_q`, `?src_sort`, `?src_dir`, `?src_ps`,
 *                      `?src_<filter-id>`
 */
export function makeQueryParsers(prefix?: string) {
  const generateKey = (name: string) => (prefix ? `${prefix}_${name}` : name)
  return {
    pageKey: generateKey('p'),
    searchKey: generateKey('q'),
    sortByKey: generateKey('sort'),
    sortDirKey: generateKey('dir'),
    pageSizeKey: generateKey('ps'),
    filterKey: (filterId: string) => generateKey(filterId),
  }
}

/**
 * Dev-time guard: throws if a filter id collides with a toolkit-reserved key.
 * Runs once at hook init in dev; no-op in production.
 */
export function assertNoReservedFilterIds(filterIds: readonly string[]): void {
  // eslint-disable-next-line node/prefer-global/process
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return
  }
  for (const id of filterIds) {
    if ((RESERVED_SUFFIXES as readonly string[]).includes(id)) {
      throw new Error(
        `[usePaginatedQuery] Filter id '${id}' collides with a reserved toolkit key. Reserved: ${RESERVED_SUFFIXES.join(', ')}`,
      )
    }
  }
}

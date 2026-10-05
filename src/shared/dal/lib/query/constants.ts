/** Default rows-per-page when a table config doesn't specify one. */
export const DEFAULT_PAGE_SIZE = 20

/** Ceiling for the page URL param — 2M rows at pageSize 20. Blocks absurd OFFSETs (full-table-scan DoS) and parseInt float overflow reaching the procedure. */
export const MAX_PAGE = 100_000

/** How many windows either side of the current one `useDataViewQuery` prefetches, per window kind. */
export const ADJACENT_WINDOW_RADIUS = { page: 1, date: 2 } as const

/** URL suffixes a data view owns (page, search, sort, direction, page size, date anchor, date view); a field id may never be one. */
export const RESERVED_URL_SUFFIXES = ['p', 'q', 'sort', 'dir', 'ps', 'd', 'v'] as const
export type ReservedUrlSuffix = (typeof RESERVED_URL_SUFFIXES)[number]

/** Reads that load a runtime-option filter's choices; `OPTION_SOURCE_READS` maps each to its tRPC query. */
export const OPTION_SOURCES = ['trades', 'reps', 'leadSources'] as const
export type OptionSource = (typeof OPTION_SOURCES)[number]

/** Default rows-per-page when a table config doesn't specify one. */
export const DEFAULT_PAGE_SIZE = 20

/** Ceiling for the page URL param — 2M rows at pageSize 20. Blocks absurd OFFSETs (full-table-scan DoS) and parseInt float overflow reaching the procedure. */
export const MAX_PAGE = 100_000

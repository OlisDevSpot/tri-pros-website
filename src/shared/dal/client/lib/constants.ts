/**
 * Standard rows-per-page choices for records-page tables. Override only
 * when an entity has a real reason to (e.g. a heavy row needs smaller
 * default pages).
 */
export const DEFAULT_RECORDS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

/** Default search-input debounce (ms) for `usePaginatedQuery`. */
export const DEFAULT_DEBOUNCE_MS = 250

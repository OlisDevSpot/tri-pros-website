import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'

const EMPTY_PAGE: PaginatedResult<never> = { rows: [], total: 0 }

/**
 * What a data-view hook reads in a pending view with nothing to show (`useLoadingScreenRead` returned null). Every hook
 * call must run on every render, so the hook still calls `useSuspenseQuery`, on a key that already holds data and never
 * goes stale: it never suspends and never fetches.
 */
export const EMPTY_DATA_VIEW_READ = {
  queryKey: ['data-view', 'pending'] as const,
  queryFn: () => EMPTY_PAGE,
  initialData: EMPTY_PAGE,
  staleTime: Infinity,
  gcTime: Infinity,
}

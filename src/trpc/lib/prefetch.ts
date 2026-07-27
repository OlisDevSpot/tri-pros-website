import type { TRPCQueryOptions } from '@trpc/tanstack-react-query'

import { getQueryClient } from '@/trpc/server'

// tRPC's overloaded queryOptions generics require `any` here (same precedent
// as use-paginated-query.ts's PaginatedQueryFactory).
// eslint-disable is not needed — ts/no-explicit-any is off repo-wide.
type AnyQueryOptions = ReturnType<TRPCQueryOptions<any>>

function assertExpectedKeyShape(queryOptions: AnyQueryOptions): void {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NODE_ENV !== 'production' && Array.isArray(queryOptions.queryKey[0]) === false) {
    // Discriminator below assumes no tRPC keyPrefix (meta object at queryKey[1]).
    throw new Error('[prefetch] unexpected queryKey shape — was the tRPC keyPrefix flag enabled? Update the infinite discriminator in prefetch.ts.')
  }
}

function executePrefetch(queryOptions: AnyQueryOptions): Promise<void> {
  assertExpectedKeyShape(queryOptions)
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    return queryClient.prefetchInfiniteQuery(queryOptions as never)
  }
  return queryClient.prefetchQuery(queryOptions)
}

/**
 * Fire-and-forget server-side prefetch (the canonical tRPC v11 form — never
 * await this; it returns void so awaiting is impossible by type). The pending
 * query is dehydrated and streamed: suspense views resolve it via
 * useSuspenseQuery; paginated tables' useQuery adopts the streamed promise
 * with no client roundtrip. Awaiting a prefetch in a page body re-blocks the
 * route on EVERY soft navigation (Next re-runs dynamic pages each nav) — that
 * regression is why the blocking variant was removed; see
 * docs/superpowers/plans/2026-07-26-prefetch-hydration-fault-audit.md (addendum).
 */
export function prefetch<T extends AnyQueryOptions>(queryOptions: T): void {
  void executePrefetch(queryOptions)
}

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
 * Tier 2 (plain-useQuery views, e.g. any paginated table): AWAIT this — it
 * blocks the RSC render so hydration lands with data. Fire-and-forget +
 * useQuery flashes a skeleton because the streamed query is still pending
 * at hydration.
 */
export function prefetchBlocking<T extends AnyQueryOptions>(queryOptions: T): Promise<void> {
  return executePrefetch(queryOptions)
}

/**
 * Tier 1 (suspense views): fire-and-forget — the pending query is dehydrated
 * and streamed; the view's useSuspenseQuery resolves it without a client
 * round-trip. Returns void so awaiting it is impossible by design.
 */
export function prefetchStreaming<T extends AnyQueryOptions>(queryOptions: T): void {
  void executePrefetch(queryOptions)
}

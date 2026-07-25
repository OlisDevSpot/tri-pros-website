import type { TRPCQueryOptions } from '@trpc/tanstack-react-query'

import { getQueryClient } from '@/trpc/server'

/**
 * Server-side prefetch into the per-request query client. The dehydrated
 * result reaches the browser through `<HydrateClient>`.
 *
 * Tier 1 (suspense views): `void prefetch(...)` — pending query is dehydrated
 * and streamed; the client `useSuspenseQuery` resolves it.
 * Tier 2 (paginated `useQuery` tables): `await prefetch(...)` — blocks the RSC
 * render so hydration lands with data (void + useQuery flashes a skeleton).
 */
// `any` mirrors use-paginated-query.ts: TRPCQueryOptions's generic can't be
// expressed without it; the concrete `T` still narrows the return type below.
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T): Promise<void> {
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    return queryClient.prefetchInfiniteQuery(queryOptions as never)
  }
  return queryClient.prefetchQuery(queryOptions)
}

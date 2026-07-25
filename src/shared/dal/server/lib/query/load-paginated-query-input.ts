import type { SearchParams } from 'nuqs/server'

import type { PaginatedQueryConfig, PaginatedQueryInput } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { createLoader } from 'nuqs/server'

import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'
import 'server-only'

/**
 * Server-side mirror of `usePaginatedQuery`'s first-mount input. Parses the
 * page's `searchParams` with the SAME parser map and assembles the input with
 * the SAME `derivePaginatedQueryState` the client hook uses, so
 * `prefetch(factory.queryOptions(await loadPaginatedQueryInput(...)))` in a
 * page.tsx produces a hydration cache-hit on the client's first render.
 *
 * `config` MUST be the same exported per-table config object the table
 * component passes to `usePaginatedQuery`; `extra` MUST match the hook's
 * `extra` argument (business inputs like `{ id }`).
 */
export async function loadPaginatedQueryInput<TExtra extends object = Record<string, never>>(
  searchParams: Promise<SearchParams> | SearchParams,
  config: PaginatedQueryConfig,
  extra?: TExtra,
): Promise<PaginatedQueryInput & TExtra> {
  // Cast mirrors use-paginated-query.ts: the dynamic parser record can't
  // express createLoader's precise generic; values are narrowed downstream.
  const load = createLoader(makePaginatedParsers(config) as never)
  const urlState = await load(Promise.resolve(searchParams))
  const { input } = derivePaginatedQueryState(urlState as Record<string, unknown>, config)
  return { ...input, ...extra } as PaginatedQueryInput & TExtra
}

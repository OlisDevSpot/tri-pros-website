# tRPC Server-Side Prefetch + Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server components prefetch tRPC queries (nuqs-aware for paginated tables) so the client's TanStack Query cache is hydrated with data before first render — eliminating the mount → HTTP round-trip → skeleton waterfall.

**Architecture:** Three seams. (1) `src/trpc/` gains a fixed RSC request context, a `prefetch()` helper, and an enriched `HydrateClient` (HydrationBoundary + ErrorBoundary + Suspense with `LoadingState`/`ErrorState` defaults). (2) The paginated toolkit's query-input assembly moves into a pure isomorphic `derivePaginatedQueryState()` consumed by BOTH `usePaginatedQuery` (client) and a new `loadPaginatedQueryInput()` server loader (nuqs `createLoader`) — guaranteeing identical query keys server/client. (3) Two adoption tiers: **Tier 1** (static-input views) = `void prefetch` + `useSuspenseQuery`/`useSuspenseQueries` + Suspense streaming; **Tier 2** (paginated `useQuery` tables) = `await prefetch` so hydration lands with data (no `void` — `void` + `useQuery` causes a loading flash, tRPC discussion #6468).

**Tech Stack:** `@trpc/tanstack-react-query` ^11.4.1 (`createTRPCOptionsProxy`), `@tanstack/react-query` ^5.80.7 (pending-query dehydration is already configured in `query-client.ts`), `nuqs` ^2.8.6 (`createLoader` from `nuqs/server`), `react-error-boundary` (NEW dep), better-auth session via `next/headers`.

## Global Constraints

- Package manager: **pnpm**. NEVER run `pnpm build`. Verification gates are `pnpm tsc` and `pnpm lint` only.
- **Do NOT `git commit` without explicit user approval.** Commit checkpoints below mean "offer the user a commit with these paths" — if declined, continue.
- Named exports only. One React component per file. No file-level constants/helpers in component files (constants → `constants/`, helpers → `lib/`).
- Explicit return types on exported functions. No `any` except where tRPC's overloaded generics force it (existing precedent: `use-paginated-query.ts` — carry the same eslint-disable comments).
- `'use client'` pushed to leaves; `page.tsx` files stay server components.
- Import parsers in **shared/isomorphic files from `'nuqs/server'`** (safe on both sides); client components keep importing hooks from `'nuqs'`.
- Lint auto-fixes import ordering: run `pnpm lint --fix` on touched files before the gate.
- Behavior-preservation rule for Task 3: `usePaginatedQuery`'s observable behavior (URL keys, query keys, return shape) must NOT change — the other 7 consumers are untouched.

---

### Task 1: RSC request context — fix the headerless `getSession`

The server proxy's ctx is the only `getSession()` call in the repo that omits request headers, so every authed prefetch would throw UNAUTHORIZED. Delegate to the existing HTTP context builder so session resolution has one home.

**Files:**
- Modify: `src/trpc/lib/create-http-context.ts`
- Modify: `src/trpc/server.ts`

**Interfaces:**
- Produces: `createRSCTRPCContext(): Promise<HTTPTRPCContext>` (exported from `create-http-context.ts`) — React-`cache()`'d per request; resolves session from `next/headers`; `req` is `undefined` (RSC has no adapter Request — acceptable: only shareable-token procedures read `req`, and those are never server-prefetched).

- [ ] **Step 1: Add `createRSCTRPCContext` to `create-http-context.ts`**

Append after the existing `createHTTPTRPCContext`:

```ts
// ─── createRSCTRPCContext ────────────────────────────────────────────────────
// Context for server-component prefetching via the options proxy in
// `src/trpc/server.ts`. Same session resolution as the HTTP adapter (headers
// from next/headers), but with no adapter Request: `req` stays undefined, so
// shareable-token procedures (which read `?token=` off `req`) must never be
// server-prefetched. React cache() dedupes per request.
export const createRSCTRPCContext = cache(async (): Promise<HTTPTRPCContext> =>
  createHTTPTRPCContext({ resHeaders: new Headers() }))
```

- [ ] **Step 2: Rewire `src/trpc/server.ts` to use it**

Replace the whole file with:

```ts
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { cache } from 'react'
import { createRSCTRPCContext } from '@/trpc/lib/create-http-context'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/app'
import 'server-only' // <-- ensure this file cannot be imported from the client
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy({
  ctx: createRSCTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
})
```

(Removes the now-unused `env` and `auth` imports and the broken hand-rolled ctx — including the stray `setCookie` prop, which isn't part of `HTTPTRPCContext`. The file deliberately stays `server.ts` — `HydrateClient` lives in its own component file (Task 2), so no rename ripple through the docs that cite `server.ts`.)

- [ ] **Step 3: Gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (no other file imports the removed symbols).

- [ ] **Step 4: Commit checkpoint (ask user)**

Offer: `git add src/trpc/lib/create-http-context.ts src/trpc/server.ts` → `fix(trpc): resolve RSC prefetch session via request headers`

---

### Task 2: `prefetch()` helper + `HydrateClient` + error boundary

**Files:**
- Create: `src/trpc/lib/prefetch.ts`
- Create: `src/trpc/components/hydration-error-fallback.tsx`
- Create: `src/trpc/components/hydration-error-boundary.tsx`
- Create: `src/trpc/components/hydrate-client.tsx`
- Modify: `package.json` (via `pnpm add react-error-boundary`)

**Interfaces:**
- Consumes: `getQueryClient` from Task 1's `src/trpc/server.ts`.
- Produces:
  - `prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T): Promise<void>` — **returns the promise**; Tier 1 call sites `void prefetch(...)` (stream), Tier 2 call sites `await prefetch(...)` (block until cached). Auto-routes infinite queries to `prefetchInfiniteQuery`.
  - `HydrateClient({ children, fallback?, errorFallback? })` — server component: `HydrationBoundary(dehydrate(getQueryClient()))` → `HydrationErrorBoundary` → `Suspense`. `fallback` defaults to `<LoadingState title="Loading…" />`; `errorFallback` defaults to `<HydrationErrorFallback />` (ErrorState + retry button wired to query-error reset).

- [ ] **Step 1: Install dependency**

Run: `pnpm add react-error-boundary`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/trpc/lib/prefetch.ts`**

```ts
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
// eslint-disable-next-line ts/no-explicit-any -- tRPC's overloaded queryOptions generic requires it (same precedent as use-paginated-query.ts)
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T): Promise<void> {
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    return queryClient.prefetchInfiniteQuery(queryOptions as never)
  }
  return queryClient.prefetchQuery(queryOptions)
}
```

(If the lint rule name differs — `@typescript-eslint/no-explicit-any` — mirror whatever disable comment `use-paginated-query.ts:24-26` uses.)

- [ ] **Step 3: Create `src/trpc/components/hydration-error-fallback.tsx`**

```tsx
'use client'

import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'

interface Props {
  onRetry: () => void
}

export function HydrationErrorFallback({ onRetry }: Props) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 rounded-lg border p-8">
      <ErrorState className="border-none" title="Something went wrong" description="The data for this page failed to load." />
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/trpc/components/hydration-error-boundary.tsx`**

```tsx
'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function HydrationErrorBoundary({ children, fallback }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) =>
            fallback ?? <HydrationErrorFallback onRetry={() => resetErrorBoundary()} />}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
```

- [ ] **Step 5: Create `src/trpc/components/hydrate-client.tsx`**

```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Suspense } from 'react'

import { LoadingState } from '@/shared/components/states/loading-state'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { getQueryClient } from '@/trpc/server'

interface Props {
  children: React.ReactNode
  /** Suspense fallback while Tier-1 children stream. Default: LoadingState. */
  fallback?: React.ReactNode
  /** Error UI. Default: ErrorState + retry wired to query-error reset. */
  errorFallback?: React.ReactNode
}

export function HydrateClient({ children, fallback, errorFallback }: Props) {
  const queryClient = getQueryClient()
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HydrationErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback ?? <LoadingState title="Loading…" />}>
          {children}
        </Suspense>
      </HydrationErrorBoundary>
    </HydrationBoundary>
  )
}
```

Note: importing `getQueryClient` makes this file transitively `server-only` — correct: `HydrateClient` may only be rendered by server components (pages).

Placement rationale: these three components live under `src/trpc/components/` (new dir), NOT `src/shared/components/` — import directionality (coding-conventions Rule 12) says `shared/` may only import from `shared/`, and `HydrateClient` must import `@/trpc/server`. Co-locating the error-boundary pair keeps the seam in one place.

- [ ] **Step 6: Gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit checkpoint (ask user)**

Offer: `git add package.json pnpm-lock.yaml src/trpc/lib/prefetch.ts src/trpc/components/` → `feat(trpc): prefetch helper + HydrateClient with suspense/error boundaries`

---

### Task 3: Isomorphic paginated query-input module

Move the URL-key + filter-parser modules to a shared home and extract the input assembly (currently inline in the hook at `use-paginated-query.ts:126-179`) into one pure function. **Behavior-preserving** — query keys and URL keys must be byte-identical before/after.

**Files:**
- Create: `src/shared/dal/lib/query/constants.ts`
- Move: `src/shared/dal/client/lib/url-state.ts` → `src/shared/dal/lib/query/url-state.ts` (content unchanged)
- Move: `src/shared/dal/client/lib/filter-parser-registry.ts` → `src/shared/dal/lib/query/filter-parser-registry.ts` (change `from 'nuqs'` → `from 'nuqs/server'`; everything else unchanged)
- Create: `src/shared/dal/lib/query/derive-paginated-query-state.ts`
- Modify: `src/shared/dal/client/hooks/use-paginated-query.ts`

**Interfaces:**
- Produces:

```ts
export interface PaginatedQueryConfig {
  paramPrefix?: string
  pageSize?: number
  pageSizeOptions?: readonly number[]
  defaultSort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  filters?: readonly FilterDefinition[]
}
export interface PaginatedQueryInput {
  pagination: { limit: number, offset: number }
  sort?: { sortBy: string, sortDir: 'asc' | 'desc' }
  search?: string
  filters?: Record<string, FilterValue>
}
export interface PaginatedQueryState {
  input: PaginatedQueryInput
  page: number
  pageSize: number
  sortBy: string | undefined
  sortDir: 'asc' | 'desc' | undefined
  filters: FilterState
}
export function makePaginatedParsers(config: PaginatedQueryConfig): Record<string, unknown>
export function derivePaginatedQueryState(urlState: Record<string, unknown>, config: PaginatedQueryConfig): PaginatedQueryState
```

- Consumed by: Task 4's server loader and the refactored hook.

- [ ] **Step 1: Create `src/shared/dal/lib/query/constants.ts`**

```ts
/** Default rows-per-page when a table config doesn't specify one. */
export const DEFAULT_PAGE_SIZE = 20
```

- [ ] **Step 2: Move the two files**

```bash
mkdir -p src/shared/dal/lib/query
git mv src/shared/dal/client/lib/url-state.ts src/shared/dal/lib/query/url-state.ts
git mv src/shared/dal/client/lib/filter-parser-registry.ts src/shared/dal/lib/query/filter-parser-registry.ts
```

In the moved `filter-parser-registry.ts`, change line 4:

```ts
import { parseAsArrayOf, parseAsBoolean, parseAsJson, parseAsString } from 'nuqs/server'
```

(Type imports of `FilterValue` from `@/shared/dal/client/lib/types` stay — type-only imports are erased and safe cross-boundary.)

- [ ] **Step 3: Create `src/shared/dal/lib/query/derive-paginated-query-state.ts`**

```ts
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
```

- [ ] **Step 4: Refactor `use-paginated-query.ts` to consume the shared module**

Changes (surgical — everything not listed stays as-is):

1. Imports: drop `parseAsInteger, parseAsString, parseAsStringEnum` from `'nuqs'` (keep `useQueryStates`); update `filterParserRegistry` + `makeQueryParsers`/`assertNoReservedFilterIds` import paths to `@/shared/dal/lib/query/filter-parser-registry` and `@/shared/dal/lib/query/url-state`; add:

```ts
import type { PaginatedQueryConfig, PaginatedQueryInput } from '@/shared/dal/lib/query/derive-paginated-query-state'
import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'
import { DEFAULT_PAGE_SIZE } from '@/shared/dal/lib/query/constants'
```

2. Delete the local `PaginatedQueryInput` interface (lines 29-37) and the local `DEFAULT_PAGE_SIZE` constant (line 58) — both now imported. Re-export the type for existing importers' convenience: `export type { PaginatedQueryInput }`. Also sweep the file-level `DEFAULT_DEBOUNCE_MS` (line 59) into `src/shared/dal/client/lib/constants.ts` (client-only concern; precedent: `DEFAULT_RECORDS_PAGE_SIZE_OPTIONS` lives there) and import it — convention-auditor sweep, `#no-component-file-constants-or-helpers`.
3. Change `UsePaginatedQueryOptions` to extend the shared config:

```ts
interface UsePaginatedQueryOptions extends PaginatedQueryConfig {
  /** Search debounce in ms. */
  searchDebounceMs?: number
  /** Disable the query without losing URL state. */
  enabled?: boolean
  /** Prefetch the next page when the current page resolves. */
  prefetchNextPage?: boolean
}
```

4. Replace the parsers memo (lines 105-117) with:

```ts
  // Deep-key array/object options so consumers passing inline literals don't
  // churn config identity every render (queryInput stability feeds the
  // next-page prefetch effect — same robustness the old primitive deps had).
  const pageSizeOptionsKey = JSON.stringify(pageSizeOptions ?? null)
  const config = useMemo<PaginatedQueryConfig>(() => ({
    paramPrefix,
    pageSize: initialPageSize,
    pageSizeOptions,
    defaultSort,
    filters: filterDefinitions,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageSizeOptions deep-keyed via pageSizeOptionsKey; defaultSort by its two fields
  }), [paramPrefix, initialPageSize, pageSizeOptionsKey, defaultSort?.sortBy, defaultSort?.sortDir, filterDefinitions])

  const parsers = useMemo(() => makePaginatedParsers(config), [config])
```

5. Replace the value-derivation block (lines 125-156: page/searchInput/sort/pageSize reads, `filterValues` memo) and the `queryInput` memo (163-179) with:

```ts
  const searchInput = (stateAny[keys.searchKey] as string) ?? ''
  const searchDebounced = useDebounce(searchInput.trim(), searchDebounceMs)

  const derived = useMemo(
    () => derivePaginatedQueryState(
      { ...stateAny, [keys.searchKey]: searchDebounced },
      config,
    ),
    [stateAny, keys.searchKey, searchDebounced, config],
  )
  const { page, pageSize: effectivePageSize, sortBy, sortDir, filters: filterValues } = derived
  const offset = derived.input.pagination.offset

  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter(v => v !== undefined).length,
    [filterValues],
  )

  // Stable-stringify `extra` so a fresh-ref-each-render `extra` doesn't
  // re-trigger the prefetch effect or invalidate downstream memos.
  const extraKey = JSON.stringify(extra)

  const queryInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...derived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [derived, extraKey],
  )
```

6. Everything downstream (the `useQuery` call, clamp effect, next-page prefetch, setters, return object) is unchanged — the same variable names (`page`, `effectivePageSize`, `offset`, `sortBy`, `sortDir`, `filterValues`, `searchInput`, `searchDebounced`, `queryInput`) are all still in scope.

- [ ] **Step 5: Gate + behavior check**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.
Then verify query-key parity by inspection: for a pristine URL the derived input must be `{ pagination: { limit: 20, offset: 0 } }` with `sort`/`search`/`filters` all `undefined` — same as before the refactor (compare against the deleted inline logic; the six coercion rules are listed in the `derivePaginatedQueryState` doc comment).

- [ ] **Step 6: Commit checkpoint (ask user)**

Offer: `git add src/shared/dal/lib/query/ src/shared/dal/client/hooks/use-paginated-query.ts` (git mv already staged the moves) → `refactor(dal): extract isomorphic paginated query-input builder`

---

### Task 4: Server loader `loadPaginatedQueryInput`

**Files:**
- Create: `src/shared/dal/server/lib/query/load-paginated-query-input.ts`

**Interfaces:**
- Consumes: `makePaginatedParsers`, `derivePaginatedQueryState`, `PaginatedQueryConfig`, `PaginatedQueryInput` from Task 3.
- Produces: `loadPaginatedQueryInput<TExtra extends object>(searchParams, config, extra?): Promise<PaginatedQueryInput & TExtra>` — used by Tier-2 pages.

- [ ] **Step 1: Create the file**

```ts
import type { SearchParams } from 'nuqs/server'

import { createLoader } from 'nuqs/server'

import type { PaginatedQueryConfig, PaginatedQueryInput } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'

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
  // Promise.resolve: nuqs' loader overloads don't distribute over the
  // plain-or-promise union; normalizing to Promise<SearchParams> satisfies
  // the async overload with identical runtime behavior.
  const urlState = await load(Promise.resolve(searchParams))
  const { input } = derivePaginatedQueryState(urlState as Record<string, unknown>, config)
  return { ...input, ...extra } as PaginatedQueryInput & TExtra
}
```

- [ ] **Step 2: Gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

---

### Task 5: Customers table — shared config + Tier-2 page conversion (primary test case)

**Files:**
- Create: `src/shared/entities/customers/constants/customers-table-query-config.ts`
- Modify: `src/shared/entities/customers/components/customers-table.tsx`
- Modify: `src/app/(frontend)/dashboard/customers/page.tsx`

**Interfaces:**
- Consumes: `PaginatedQueryConfig` (Task 3), `loadPaginatedQueryInput` (Task 4), `prefetch` + `HydrateClient` (Task 2), `trpc` server proxy (Task 1).
- Produces: `CUSTOMERS_TABLE_QUERY_CONFIG` — the one config object shared by page and table.

- [ ] **Step 1: Create `customers-table-query-config.ts`**

```ts
import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FILTER_CONFIG } from '@/shared/entities/customers/constants/customer-filter-config'

/**
 * Shared paginated-query config for the customers records table. Imported by
 * BOTH `customers-table.tsx` (client: `usePaginatedQuery`) and
 * `dashboard/customers/page.tsx` (server: `loadPaginatedQueryInput`) — one
 * object, one query key. Do not inline these values at either call site.
 */
export const CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pc',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
```

- [ ] **Step 2: Consume it in `customers-table.tsx`**

Replace the `usePaginatedQuery` call (lines 34-43) with:

```ts
  const pagination = usePaginatedQuery<Record<string, never>, CustomerTableRow>(
    trpc.customersRouter.business.list.queryOptions,
    {},
    CUSTOMERS_TABLE_QUERY_CONFIG,
  )
```

Add the import, remove the now-unused `DEFAULT_RECORDS_PAGE_SIZE_OPTIONS` and `CUSTOMER_FILTER_CONFIG` imports from this file.

Also sweep the pre-existing violation the auditor flagged: move `SHOW_COLUMNS` (line 27, file-level const in a component file) into `src/shared/entities/customers/constants/customers-table-query-config.ts` as a second export:

```ts
/** Columns shown by default on the customers records table. */
export const CUSTOMERS_TABLE_SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const
```

and update the `useEntityColumns(CUSTOMER_COLUMNS, { show: CUSTOMERS_TABLE_SHOW_COLUMNS })` call site.

- [ ] **Step 3: Convert `dashboard/customers/page.tsx` (Tier 2 = `await prefetch`)**

```tsx
import type { SearchParams } from 'nuqs/server'

import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { loadPaginatedQueryInput } from '@/shared/dal/server/lib/query/load-paginated-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { CustomersTable } from '@/shared/entities/customers/components/customers-table'
import { CUSTOMERS_TABLE_QUERY_CONFIG } from '@/shared/entities/customers/constants/customers-table-query-config'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function CustomersPage({ searchParams }: Props) {
  await protectDashboardPage()

  // Tier 2 (useQuery table): AWAIT the prefetch — void + useQuery flashes a
  // skeleton because the streamed query is still pending at hydration.
  const input = await loadPaginatedQueryInput(searchParams, CUSTOMERS_TABLE_QUERY_CONFIG)
  await prefetch(trpc.customersRouter.business.list.queryOptions(input))

  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <CustomersTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
```

(Default-export function is the Next.js page convention — the named-exports rule doesn't apply to `page.tsx` route files, matching every existing page.)

- [ ] **Step 4: Gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Runtime verification (dev server)**

Run `pnpm dev`, sign in, open `/dashboard/customers` with DevTools → Network:
- The table renders **with rows on first paint** — no skeleton phase, `isLoading` never true.
- **No** `/api/trpc/customersRouter.business.list` request fires on initial load (data came from hydration; staleTime 30s suppresses refetch).
- Navigate to `?pc_p=2` directly (hard reload): page 2 rows render immediately — proves the loader mirrors non-default URL state.
- Change a filter chip: client-side refetch fires normally (`keepPreviousData` still works, rows stay mounted).

- [ ] **Step 6: Commit checkpoint (ask user)**

Offer: `git add src/shared/entities/customers/ "src/app/(frontend)/dashboard/customers/page.tsx" src/shared/dal/server/lib/query/load-paginated-query-input.ts` → `feat(customers): server-prefetch + hydration for records table (Tier 2)`

---

### Task 6: Campaigns overview — Tier-1 conversion (suspense + streaming)

**Files:**
- Modify: `src/features/campaigns-admin/constants/query-parsers.ts`
- Create: `src/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton.tsx`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-view.tsx`
- Modify: `src/app/(frontend)/dashboard/campaigns/page.tsx`

**Interfaces:**
- Consumes: `prefetch`, `HydrateClient` (Task 2).
- Produces: `loadCampaignsSearchParams(searchParams): Promise<{ tab: CampaignTab }>`.

- [ ] **Step 1: Make the tab parser isomorphic + add a loader**

Replace `src/features/campaigns-admin/constants/query-parsers.ts` with:

```ts
import { createLoader, parseAsStringLiteral } from 'nuqs/server'

export const CAMPAIGN_TABS = ['overview', 'leads', 'setup'] as const

export type CampaignTab = typeof CAMPAIGN_TABS[number]

export const campaignTabParser = parseAsStringLiteral(CAMPAIGN_TABS).withDefault('overview')

/** Server-side mirror of the `tab` URL state — lets page.tsx prefetch only the active tab's queries. */
export const loadCampaignsSearchParams = createLoader({ tab: campaignTabParser })
```

(`campaigns-view.tsx` keeps importing `campaignTabParser` unchanged — parsers from `nuqs/server` work client-side.)

- [ ] **Step 2: Extract the skeleton to its own component file**

Create `src/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton.tsx` with the exact JSX currently inside the view's `isLoading` branch:

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

export function CampaignsOverviewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-1" aria-label="Loading campaigns overview">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="h-44 w-full"
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Convert the view to `useSuspenseQueries`**

In `campaigns-overview-view.tsx`: replace the two `useQuery` calls, the `?? []` fallbacks, and the whole `if (isLoading)` block with:

```tsx
'use client'

import { useSuspenseQueries } from '@tanstack/react-query'

import { partitionSourceSummaries } from '@/features/campaigns-admin/lib/partition-source-summaries'
import { IdleSourcesList } from '@/features/campaigns-admin/ui/components/overview/idle-sources-list'
import { OverviewSummaryBar } from '@/features/campaigns-admin/ui/components/overview/overview-summary-bar'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  // useSuspenseQueries (plural), NOT two useSuspenseQuery calls — sequential
  // suspense hooks in one component waterfall; the plural API fires both in
  // parallel and matches the page's two parallel prefetches.
  const [{ data: summaries }, { data: campaigns }] = useSuspenseQueries({
    queries: [
      trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions(),
      trpc.voipCampaignsRouter.listCampaigns.queryOptions(),
    ],
  })
  // ...rest of the component body unchanged (totals reduce, partition, JSX),
  // minus the deleted isLoading branch; `summaries`/`campaigns` are now
  // non-nullable so drop `data ?? []`.
```

The Skeleton import goes away from this file (it moved to the skeleton component).

- [ ] **Step 4: Add the tab-level Suspense boundary in `campaigns-view.tsx`**

```tsx
import { Suspense } from 'react'
import { CampaignsOverviewSkeleton } from '@/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton'
```

and change the overview TabsContent to:

```tsx
        <TabsContent className="flex min-h-0 flex-1 flex-col" value="overview">
          <Suspense fallback={<CampaignsOverviewSkeleton />}>
            <CampaignsOverviewView />
          </Suspense>
        </TabsContent>
```

(The suspension is caught here — layout-matched skeleton — instead of bubbling to `HydrateClient`'s generic page-level fallback, which remains the safety net.)

- [ ] **Step 5: Convert `dashboard/campaigns/page.tsx` (Tier 1 = `void prefetch`)**

```tsx
import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { loadCampaignsSearchParams } from '@/features/campaigns-admin/constants/query-parsers'
import { CampaignsView } from '@/features/campaigns-admin/ui/views/campaigns-view'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function CampaignsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  // Tier 1 (suspense view): void prefetch — pending queries are dehydrated
  // and streamed; the view's useSuspenseQueries resolves them without a
  // client round-trip. Only the active tab's queries are prefetched.
  const { tab } = await loadCampaignsSearchParams(searchParams)
  if (tab === 'overview') {
    void prefetch(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
    void prefetch(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  }

  return (
    <HydrateClient>
      <CampaignsView />
    </HydrateClient>
  )
}
```

- [ ] **Step 6: Gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Runtime verification (dev server)**

As super-admin, open `/dashboard/campaigns`:
- Overview cards render without the client firing `/api/trpc/voipCampaignsRouter.*` requests on load (streamed hydration).
- Open `/dashboard/campaigns?tab=leads` (hard load): NO overview prefetch happens server-side; switching to the Overview tab client-side shows the skeleton once, then data (normal client fetch — expected, `shallow: true`).
- Temporarily throw inside `getSourceCampaignSummaries` (or kill the DB connection) and reload: the `HydrationErrorFallback` renders with a working "Try again" button. Revert the sabotage.

- [ ] **Step 8: Commit checkpoint (ask user)**

Offer: `git add src/features/campaigns-admin/ "src/app/(frontend)/dashboard/campaigns/page.tsx"` → `feat(campaigns): server-prefetch + suspense streaming for overview (Tier 1)`

---

### Task 7: Convention docs + memory

**Files:**
- Modify: `docs/codebase-conventions/frontend-stack.md`
- Modify: `docs/codebase-conventions/query-toolkit.md`
- Modify: `src/trpc/DOCS.md`
- Create: `memory/pattern-server-prefetch-hydration.md` (+ index line in `memory/MEMORY.md`)

- [ ] **Step 0: Fix stale refs the convention-auditor found (same pass)**

- `query-toolkit.md:10-14, 85, 93` — cites `src/shared/dal/client/lib/query/` which doesn't exist; real paths are `src/shared/dal/client/hooks/use-paginated-query.ts` + (post-Task-3) `src/shared/dal/lib/query/{url-state,filter-parser-registry}.ts`.
- `query-toolkit.md:73-82` (`#filter-types-via-registry`) — lists four filter types with `from_to` date serialization; code has **five** (`number-range` added) and date-range/number-range serialize via `parseAsJson` (JSON-encoded URL values). Rewrite the table to match `filter-parser-registry.ts:23-46`.
- `src/trpc/DOCS.md:21` — says `create-http-context.ts` "builds BaseTRPCContext"; it returns `HTTPTRPCContext`. Fix wording.
- `frontend-stack.md#use-client-pushed-to-leaves` — "Views that fetch via tRPC are client components" needs the tier nuance appended: "…client components; their *data* may already be server-prefetched and hydrated (see `server-prefetch-two-tiers`)."

- [ ] **Step 1: Amend `frontend-stack.md`** — extend the `views-own-data-fetching` rule and add a new rule after it:

```markdown
### views-own-data-fetching

Views (`ui/views/<x>-view.tsx`) own data fetching and layout. Components (`ui/components/`) are props-driven and reusable — never call tRPC. Two fetching tiers (see `server-prefetch-two-tiers`):

- **Tier 1 (suspense views)**: static-input queries → `useSuspenseQuery` / `useSuspenseQueries` (plural for 2+ queries — sequential singular calls waterfall); no isLoading branches; loading/error UI lives at the page seam.
- **Tier 2 (paginated tables)**: nuqs-driven keys via `usePaginatedQuery` → stays `useQuery` + `keepPreviousData` (suspense is incompatible with placeholderData).

**Why**: server components keep the bundle smaller and let RSC stream. Views stay the integration point; the page decides prefetch strategy.
**Reference impl**: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx` (Tier 1), `src/shared/entities/customers/components/customers-table.tsx` (Tier 2)
**Enforced by**: convention

### server-prefetch-two-tiers

Dashboard pages prefetch their view's queries server-side and wrap children in `<HydrateClient>` (`src/trpc/components/hydrate-client.tsx`). The tier decides await semantics:

- **Tier 1** (view uses `useSuspenseQuery`): `void prefetch(trpc.x.y.queryOptions(...))` — pending query dehydrates and streams. Put a layout-matched `<Suspense fallback>` close to the view; `HydrateClient`'s built-in boundary is the safety net.
- **Tier 2** (view uses `useQuery`, e.g. any `usePaginatedQuery` table): `await prefetch(...)` — `void` + `useQuery` flashes a skeleton (streamed query still pending at hydration). Build the input with `loadPaginatedQueryInput(searchParams, CONFIG)` using the table's shared config object (see query-toolkit.md#shared-table-config).

Never import `@/trpc/server` (or `prefetch`/`HydrateClient`) into a client component.

**Why**: pages already block on `protectDashboardPage()`'s session read; prefetching piggybacks on a round-trip the server is already making, removing the client's mount→fetch waterfall.
**Reference impl**: `src/app/(frontend)/dashboard/customers/page.tsx` (Tier 2), `src/app/(frontend)/dashboard/campaigns/page.tsx` (Tier 1 + tab-conditional prefetch)
**Enforced by**: `server-only` package (bundle boundary) + convention
```

- [ ] **Step 2: Amend `query-toolkit.md`** — update the four-layer diagram to five layers (add `Server loader → loadPaginatedQueryInput (RSC prefetch input mirror)` under the server primitives) and add a rule:

```markdown
### shared-table-config

Every paginated table exports ONE `PaginatedQueryConfig` object from `constants/` (entity or feature level), consumed by BOTH the table component (`usePaginatedQuery(factory, extra, CONFIG)`) and its page (`loadPaginatedQueryInput(searchParams, CONFIG)`). Never inline paramPrefix/pageSize/filters at either call site — a config drift between server and client is a silent hydration cache-miss.

The input assembly itself lives in `derivePaginatedQueryState()` (`src/shared/dal/lib/query/derive-paginated-query-state.ts`) — the isomorphic single source of truth for page floor, pageSize allowlist, sortDir suppression, search trim, and filter-active normalization. Never re-implement these coercions.

**Why**: the server-prefetched query key must hash identically to the client's first-mount key; one config + one builder makes divergence structurally impossible.
**Reference impl**: `src/shared/entities/customers/constants/customers-table-query-config.ts`
**Enforced by**: convention
```

Also update the file's layer table paths for the moved modules (`url-state.ts`, `filter-parser-registry.ts` now under `src/shared/dal/lib/query/`).

- [ ] **Step 3: Amend `src/trpc/DOCS.md`** — in the Layout block add:

```
  lib/prefetch.ts            server-side prefetch into the per-request query client
  components/                HydrateClient + hydration error boundary (server↔client seam)
```

And add a rule after `dont-import-server-only-trpc-into-client`:

```markdown
### rsc-prefetch-uses-rsc-context

`src/trpc/server.ts`'s options proxy resolves its context via `createRSCTRPCContext` (`src/trpc/lib/create-http-context.ts`) — the SAME session resolution as the HTTP adapter (headers from `next/headers`), React-`cache()`'d per request. Never hand-roll a ctx for the proxy; a ctx without request headers yields `session: null` and every `agentProcedure` prefetch throws UNAUTHORIZED. Note `req` is `undefined` in RSC context: shareable-token procedures must never be server-prefetched.

**Reference impl**: `src/trpc/lib/create-http-context.ts`, `src/trpc/server.ts`
**Enforced by**: convention
```

- [ ] **Step 4: Write memory** — create `memory/pattern-server-prefetch-hydration.md` (frontmatter type `project`) summarizing: the two tiers + await/void rule, the shared-config contract, `derivePaginatedQueryState` as the only input assembler, the RSC ctx fix, and pointers to the canonical docs rules. Add the index line to `memory/MEMORY.md` under Development System.

- [ ] **Step 5: Final gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit checkpoint (ask user)**

Offer: `git add docs/codebase-conventions/frontend-stack.md docs/codebase-conventions/query-toolkit.md src/trpc/DOCS.md docs/superpowers/plans/2026-07-24-trpc-prefetch-hydration.md` → `docs(conventions): server-prefetch hydration tiers + shared table config`

---

## Out of scope (recorded)

- Converting the other 7 `usePaginatedQuery` consumers and remaining Tier-1 views (Action Center, Settings, Schedule, Lead Sources) — mechanical rollout after the test cases validate; each is "add config export + page loader/prefetch + HydrateClient".
- `useSuspenseInfiniteQuery` adoption (no infinite queries exist yet; `prefetch()` already routes them).
- nuqs Standard-Schema→tRPC-input derivation (v2.6+ feature) — future consolidation of `paginatedQueryInput` Zod schemas.
- Any change to `usePaginatedQuery`'s public API or the 7 untouched consumers.

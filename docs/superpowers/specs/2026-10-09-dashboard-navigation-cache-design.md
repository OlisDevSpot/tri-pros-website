# Dashboard navigation cache — design

Status: awaiting owner review (2026-10-09).

## Problem

Navigating between the pipeline, the schedule and the record tables refreshes data that is already on the client:

1. **Every return refetches, whatever the cache holds.** Dashboard pages are `force-dynamic` and Next keeps no router cache for dynamic pages, so every soft navigation re-runs `page.tsx` on the server. Its `prefetch()` streams a pending dehydrated query, and TanStack's `HydrationBoundary` adopts it for an existing entry whenever `dehydratedAt > dataUpdatedAt`. `staleTime` is never consulted, so a return two seconds later still fetches and the toolbar hairline runs. This is intended upstream behaviour (TanStack #8369, fixed by PR #8383: a newer server prefetch wins).
2. **The loading view is blind to the cache.** Each route's `loading.tsx` renders the real view under `DataViewPending`. Inside it, `useDataViewQuery` and `usePaginatedQuery` read `EMPTY_DATA_VIEW_READ`, and the dashboard home sections render their skeletons, even when the cache holds the rows. In production Next prefetches `loading.tsx`, so every click shows skeletons first.
3. **The cache forgets after 5 minutes.** The client `gcTime` is TanStack's default, so data you left more than five minutes ago is gone and the skeleton returns.
4. **The schedule slides sideways on entry.** `ScheduleWeekView` smooth-scrolls today's column into view from a `useEffect` on every mount. On a phone it slides twice: once in the loading view, again in the real view.

## Goal

TanStack Query owns navigation caching for every dashboard data view. `next.config.ts` stays untouched (owner ruling, 2026-10-09).

- **A return within `staleTime` (30 s) is cache-only.** No request, no hairline, no skeleton.
- **A return after `staleTime` shows the cached rows at once.** They refresh in place with the toolbar hairline, the same as the refresh button (owner ruling, 2026-10-09).
- **A first visit, or a return after the cache entry is collected, shows the view's skeletons.**
- **The schedule opens on today's column with no visible scroll.** Previous and Next still animate.

The pieces are reusable and plug in once, in the style of `useInvalidation` and the tRPC key helpers. No page carries its own caching code.

## Evidence base

Checked against the TanStack Query 5.104 and tRPC 11 documentation (via Context7), and against the installed `query-core` and `react-query` source:

- `HydrateOptions` has no per-query filter. `HydrationBoundary` never consults `staleTime`. `shouldDehydrateQuery` runs on the server, which cannot see the client cache. So filtering the dehydrated state on the client is the only seam.
- `query.isStale()` ignores time when no observer is mounted, which is exactly the case after navigating away. `query.isStaleByTime(staleTime)` does not, and it treats "no data" and "invalidated" as stale. So data invalidated by a mutation still takes the server copy.
- `useSuspenseQuery` never suspends on a cached entry. `refetchOnMount: false` stops its mount refetch.
- The docs recommend `staleTime > 0` with SSR; tRPC's own setup uses 30 s. `gcTime` is `Infinity` on the server by default, and a finite value there would keep per-request caches alive.
- Known upstream gap, TanStack #9610, fix PR #9968 (unreleased). Past `staleTime`, the mounting observer refetches before the boundary's hydration effect runs, so the server's streamed copy is discarded and that read is duplicated. Rows still refresh in place. When the fix ships it applies with no change on our side.

## Design

### 1. The freshness gate at hydration

`HydrateClient` (server component, `src/trpc/components/hydrate-client.tsx`) keeps dehydrating as it does today. It renders a new client boundary in place of `HydrationBoundary`. For each dehydrated query, that boundary drops the query when the client cache holds an entry that is still fresh by time. Everything else, including new keys, stale entries and invalidated entries, hydrates exactly as before.

- **The staleness test:** `query.isStaleByTime(staleTime)`. `staleTime` is resolved per key through `client.defaultQueryOptions({ queryKey })`, so per-family defaults set later via `setQueryDefaults` are honoured. The function form of `staleTime` is resolved against the query.
- **Memoization:** on `[client, state]`. `HydrationBoundary` memoizes on the `state` identity, so a new object every render would re-run hydration.
- **Location:** `src/trpc/components/`, beside `HydrateClient`. It is the only consumer.

Every page that uses `HydrateClient` gets the behaviour with no code of its own. The server prefetch still runs on every navigation. That work can't be avoided without Next's router cache, and the owner ruled that out. Its result is simply not applied while the client copy is fresh.

### 2. One read for "route loading" mode

The pending branch moves out of the two read hooks into a single helper in `src/shared/dal/client/hooks/`. Both `useDataViewQuery` and `usePaginatedQuery` call it in place of their own `useSuspenseQuery(isPending ? EMPTY_DATA_VIEW_READ : options)`.

- Outside a loading view, it is `useSuspenseQuery(options)`, unchanged.
- Inside a loading view, when the cache holds the key, it is `useSuspenseQuery({ ...options, refetchOnMount: false })`. The rows show, and nothing fetches from the loading view, because the page that replaces it owns the refresh.
- Inside a loading view, when the cache does not hold the key, it is `EMPTY_DATA_VIEW_READ`, which gives the skeleton.
- It is the one `useSuspenseQuery` call, so hook order never changes between renders.

The hooks' `isPending` then means "rows not available". It is true only when the loading view had no cached rows. So the empty states, the adjacent-window prefetch, the page clamp and the hydration-parity checks behave as on a real page once rows are shown. The parity and prefetch-guard checks stay limited to the real page, since they are about the server's first render.

The dashboard home sections (`DashboardProjectSection`, `DashboardProposalSection`, `DashboardSnapshotStrip`) follow the same rule through a small companion hook: in a loading view they render their list when its key is cached and the skeleton otherwise. Their lists' reads take `refetchOnMount: false` in that mode the same way.

### 3. Cache lifetimes

In `makeQueryClient`:

- `staleTime` stays `30 * 1000`.
- `gcTime` becomes `isServer ? Infinity : 30 * 60 * 1000`. Thirty minutes on the client; unchanged on the server.

Per-family overrides are possible later through `queryClient.setQueryDefaults(trpc.<router>.pathKey(), …)`; tRPC v11's key shape prefix-matches. The gate reads the resolved defaults, so an override needs no other change. None is added now.

### 4. Indicators

No new rule. The toolbar hairline keeps `isPending || isFetching || isStale`, and the pipeline keeps `aria-busy` on `isFetching`. Fresh data no longer fetches, so `isFetching` with rows on screen now means one of three things:

- the data went stale (after 30 s, or on window focus);
- a save of yours invalidated it;
- you pressed refresh.

That is the owner's rule.

### 5. Schedule week view: position, then motion

`ScheduleWeekView` positions its scroller in a `useLayoutEffect`, before the first paint. On mount, today's column is placed with `behavior: 'instant'`, or the left edge when today is outside the shown week. A later change of week keeps today's smooth scroll and the Sunday/Friday alignment. The loading view and the real view each paint at the right position, so entry shows no motion.

## Out of scope

- `next.config.ts` and Next's router cache.
- Avoiding the server-side prefetch read on soft navigations. TanStack has no API for it, because the server cannot see the client cache.
- The double read past `staleTime` (upstream #9610). We take the upstream fix when it ships.
- Per-family `staleTime` values.
- Card remounts when the loading view swaps for the real page: two separate trees, inherent to `loading.tsx`.

## Verification

Playwright checks, extending the 2026-10-09 diagnosis scripts (dev server, authenticated through `/api/dev/playwright-session`, no database writes):

1. **Return within 30 s** to the pipeline, the schedule and the meetings table: no tRPC request for the view's key, no hairline, rows on the first frame after the click.
2. **Return after 30 s:** rows on the first frame, the hairline while the refresh runs, then the hairline clears.
3. **First visit:** skeletons, then rows.
4. **After a mutation** (simulated by invalidating the cache key from the page, not by a write): the next return refetches.
5. **Schedule at 390 px:** the scroller's `scrollLeft` is at today's column on the first frame and never animates on entry; Previous and Next still animate.
6. **Gate unit test:** fresh entries are dropped; stale, invalidated and missing entries pass through; a function-form `staleTime` is resolved.

Then `pnpm tsc` and `pnpm lint`.

## Names (proposed; owner approval needed)

| Name | What it is |
|---|---|
| `FreshCacheHydrationBoundary` | The client boundary in §1 |
| `resolveQueryStaleTime` | Per-key `staleTime` resolver the gate uses |
| `useDataViewRead` | The single read in §2 |
| `useIsCachedInLoadingView` | The home sections' companion check in §2 |

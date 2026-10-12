# Instant tab return — design

Status: APPROVED by the owner 2026-10-12, revised the same day after an adversarial review (three reviewers:
conventions, runtime, verification) and owner rulings R6–R9. Carved out of the deferred
`2026-10-09-dashboard-navigation-cache-design.md`, which keeps the wider query-pattern questions.

## Goal

Inside the app, returning to a tab you used this browser session (pipeline, schedule, meetings, projects, proposals,
customers, dashboard home) shows its cached rows on the first frame, refetches every time, and replaces the rows in
place. Skeletons only on a true first visit. `next.config.ts` untouched.

## Owner rulings (2026-10-09 → 2026-10-12)

- R1. Every return refetches; the cache is shown while it does. Returning within 30 s refetching is fine.
- R2. The server's streamed copy stays the refresh on in-app navigation (one read per navigation). Browser Back/Forward
  replays Next's cached page, so it refetches only once the rows are past `staleTime`; accepted.
- R3. `staleTime` stays 30 s. Client `gcTime` 30 min (server unchanged), until Ably realtime takes over freshness.
- R4. The refresh hairline shows only while refetching rows that are older than `staleTime` or invalidated (a save, the
  refresh button). A return within 30 s refreshes silently.
- R5. Scope: the six routes with a loading screen plus dashboard home. Detail pages, analytics and lead sources get no
  loading screen of their own.
- R6. Name: `useLoadingScreenRead` (owner kept it over `usePendingViewRead`), route group `(home)`. "Loading screen"
  is a new term: a glossary entry goes into `CONTEXT.md` once that file is free (another session holds it).
- R7. A data view's error fallback stays row-less. The pending context gains a value that tells the two apart, so
  rows that failed to render never re-render inside their own fallback and escape the section's boundary.
- R8. Home's loading screen greets by name from the client session, so the greeting doesn't change on every return.
- R9. R4's rule lives in the two shared read hooks, so it applies to every data view, including lead sources,
  campaign leads and the proposal-flow table.

## Why it flashes today

1. Each route's `loading.tsx` renders the view under `DataViewPending`. The read hooks then read `EMPTY_DATA_VIEW_READ`
   and the home sections render their skeletons, whatever the cache holds. Next prefetches `loading.tsx` in production,
   so every click shows skeletons first (dev can't reproduce it: it doesn't prefetch).
2. Client `gcTime` is TanStack's default 5 min, so older entries are gone anyway.
3. `isFetching` drives the hairline, and every return refetches, so the hairline runs on every return (in production,
   where the server's streamed copy is still in flight when the page commits).
4. Dashboard home has no loading screen, so a click on Home keeps the previous page up until the server answers.
5. `ScheduleWeekView` smooth-scrolls to today from a `useEffect` on every mount: twice per entry (loading screen, then
   the page).

## Design

### 1. One rule for reads in a pending view

`DataViewPendingContext` carries `false | 'loading' | 'error'` instead of a boolean. `DataViewPending` (route loading
screens, `DataViewBoundary`'s suspense fallback, the layout's document-load skeleton, the PWA launch shell) provides
`'loading'`; `DataViewBoundary`'s error fallback provides `'error'`. `useIsDataViewPending()` stays a boolean
(`!== false`), so its readers don't change.

`useLoadingScreenRead(options)` decides what a read does:

- Outside a pending view: the options, unchanged.
- In a `'loading'` view, when the cache holds the key: the options with `refetchOnMount: false`. The rows show, and the
  loading screen starts no fetch; the page that replaces it owns the refresh (R2).
- In a `'loading'` view with nothing cached, or in an `'error'` view: `null`, and the caller draws its skeleton.

Consumers:

- `useDataViewQuery` and `usePaginatedQuery`: `null` maps to `EMPTY_DATA_VIEW_READ` (one `useSuspenseQuery` call, so
  hook order never changes). Their `isPending` then means "no rows to show". In any pending view they start no
  neighbour preload, write no URL (page clamp) and run no hydration checks: those belong to the page.
- Both hooks' hydration-drift check moves onto `useHydrationParityCheck`, which skips pending views (their reads are
  never hydration targets: the recorded keys are the previous page's).
- Dashboard home: each section's parent builds the read options, calls the hook, and returns its skeleton (or the bare
  count chips) on `null`; the child list receives the options and reads them unconditionally. No dummy read in
  feature code.
- `useScheduleHighlight` does nothing in a pending view: a deep-linked meeting scrolls and starts its 10 s timer once,
  on the page.

TanStack facts this rests on (5.104 source + docs via Context7, re-checked by the runtime review):
`useSuspenseQuery` never suspends on a cached entry; `refetchOnMount: false` stops the mount refetch; the tRPC options
spread loses nothing (the DataTag is type-only); on the page, `HydrationBoundary` adopts the server's newer streamed copy
for an existing entry after commit, which is the in-place refresh. In the loading screen `useSearchParams` (and nuqs)
already see the new URL, so the loading screen derives the page's key.

### 2. Cache lifetime

`makeQueryClient`: `gcTime: isServer ? Infinity : 30 * 60 * 1000`. A finite server value would keep each request's
cache alive; TanStack's server default is `Infinity`.

### 3. The refresh rule in one place

The two read hooks expose `isFetching` as `read.isFetching && read.isStale` on the shown read (a local
`isPastStaleTime` names TanStack's flag, distinct from the result's own `isStale`, which means "rows of an older URL").
Every consumer of `query.isFetching` (toolbar hairline, refresh-button spin, table "Updating…", pipeline `aria-busy`,
the table body's empty-state guard) then follows R4 with no edit of its own (R9). The refresh button and saves
invalidate first, which marks the rows stale for the whole refetch. Pull-to-refresh and the pipeline's move settling
await `refresh()` and don't read `isFetching`. The hooks keep TanStack's raw `isFetching` for their own preload gates.

### 4. A loading screen for dashboard home

The home page moves into a route group, `dashboard/(home)/page.tsx`, with its own `loading.tsx` rendering
`DashboardHomePendingView` under `DataViewPending`. A `loading.tsx` beside the current `dashboard/page.tsx` would also
cover every route under `dashboard/` without its own (analytics, lead sources, detail pages) and show them the home
view. The URL doesn't change. `DashboardHomePendingView` reads the name from the client session (`useSession`), which
is loaded on any in-app navigation (R8); on a document load it is still pending and the greeting has no name, as today.

### 5. Schedule entry position

On mount `ScheduleWeekView` sets its scroller's `scrollLeft` in a `useLayoutEffect`, before paint, so today's column is
in view (the left edge when today is outside the shown week). Setting the scroller directly moves only the horizontal
scroller: `scrollIntoView` would also scroll the ancestors, and `behavior: 'instant'` is not safe across engines (and
`scroll-behavior: smooth` in `globals.css` rules out `'auto'`). A later change of week keeps the smooth
`scrollIntoView` to today and the Sunday/Friday alignment.

## Accepted behaviour

- The loading screen and the page are separate trees, so the view remounts once when the page commits: same rows,
  same layout; local UI state and a scroll position set during that fraction of a second reset. The week view
  repositions before paint (§5).
- A refetch that fails while cached rows show leaves the rows and stops the hairline; the error UI stays for a read
  with no rows, as today.
- Past 30 s, the page's observer usually refetches before the boundary adopts the server's copy, so that navigation
  reads twice (TanStack #9610, fix PR #9968 unreleased). Rows still refresh in place.
- A quick return's refresh needs the server's clock to be ahead of the client's by the rows' age (TanStack adopts the
  server copy only when `dehydratedAt > dataUpdatedAt`). A client clock running fast can skip that silent refresh;
  rows older than 30 s are refetched by the page itself anyway.
- On a document load, the home greeting appears without a name until the session resolves, as today.

## Out of scope

Everything in the deferred `2026-10-09` spec: per-family freshness, polling, server-side prefetch savings, detail
pages, analytics, lead sources' loading screens.

## Verification

Playwright on the dev server (auth via `/api/dev/playwright-session`, no database writes). Dev doesn't prefetch
`loading.tsx` and receives the server's copy already resolved, so the quick-return and loading-screen checks run under
CDP download throttling, which keeps the stream in flight the way production sees it.

1. Throttled quick return (visit X → pipeline → back to X within seconds) on meetings, customers, projects, proposals,
   schedule and pipeline: when the loading screen is seen, it shows rows; no hairline; no skeleton frame with no rows.
2. Refresh button: the hairline shows, then clears.
3. A failed refetch (tRPC requests aborted, at least one abort observed) keeps the rows.
4. Dashboard home: `(home)/page.tsx` and `(home)/loading.tsx` exist and `dashboard/page.tsx` and
   `dashboard/loading.tsx` do not; analytics never shows the home view; the greeting carries the name on every frame of a
   return.
5. Schedule at 390 px: the week scroller's `scrollLeft` never moves on entry; Next still animates.
6. Unit (tsx): the hook's four cases (outside, cached `'loading'`, uncached `'loading'`, cached `'error'`) and the
   client `gcTime`.
7. No `[prefetch drift]` console errors throughout.

Then `pnpm tsc` and `pnpm lint`. Owner checks in production for what dev cannot show: no skeleton flash on any return.

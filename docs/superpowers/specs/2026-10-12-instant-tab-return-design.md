# Instant tab return — design

Status: awaiting owner review (2026-10-12). Grilled with the owner 2026-10-09 → 2026-10-12. Carved out of the deferred
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
- R4. The refresh hairline shows only while refetching rows that are stale (older than 30 s, or marked stale by a save
  or the refresh button). A return within 30 s refreshes silently.
- R5. Scope: the six routes with a loading screen plus dashboard home. Detail pages, analytics and lead sources stay out.

## Why it flashes today

1. Each route's `loading.tsx` renders the view under `DataViewPending`. The read hooks then read `EMPTY_DATA_VIEW_READ`
   and the home sections render their skeletons, whatever the cache holds. Next prefetches `loading.tsx` in production,
   so every click shows skeletons first (dev can't reproduce it: it doesn't prefetch).
2. Client `gcTime` is TanStack's default 5 min, so older entries are gone anyway.
3. `isFetching` drives the hairline, and every return refetches, so the hairline runs on every return.
4. Dashboard home has no loading screen, so a click on Home keeps the previous page up until the server answers.
5. `ScheduleWeekView` smooth-scrolls to today from a `useEffect` on every mount: twice per entry (loading view, then the
   real view).

## Design

### 1. One rule for reads in a loading screen

A single helper decides what a read does inside `DataViewPending`, used by every consumer instead of each one
special-casing the pending context:

- Outside a loading screen: the read's options, unchanged.
- Inside one, when the cache holds the key: the read's options with `refetchOnMount: false`. The rows show, and the
  loading screen starts no fetch; the page that replaces it owns the refresh (R2).
- Inside one, when the cache does not hold the key: nothing, and the consumer draws its skeleton.

Consumers:

- `useDataViewQuery` and `usePaginatedQuery`: "nothing" maps to `EMPTY_DATA_VIEW_READ` (one `useSuspenseQuery` call,
  so hook order never changes). Their `isPending` then means "no rows to show", true only on a first visit, so empty
  states, the page clamp and the neighbouring-window preloads behave as on the real page once rows show. The
  hydration-parity and prefetch-guard checks stay limited to the real page (they are about the server's first render).
- Dashboard home: `DashboardProjectSection`, `DashboardProposalSection` and `DashboardSnapshotStrip` render their lists
  when the list's key is cached and the skeleton otherwise; the lists' own reads go through the same helper. The
  snapshot strip shows its counts only when all three of its keys are cached.

TanStack facts this rests on (5.104 source + docs via Context7): `useSuspenseQuery` never suspends on a cached entry;
`refetchOnMount: false` stops the mount refetch; on the page, `HydrationBoundary` adopts the server's newer streamed
copy for an existing entry after commit, which is the in-place refresh.

### 2. Cache lifetime

`makeQueryClient`: `gcTime: isServer ? Infinity : 30 * 60 * 1000`. A finite server value would keep each request's
cache alive; TanStack's server default is `Infinity`.

### 3. The refresh rule in one place

The two read hooks expose `isFetching` as "refetching rows that are stale": TanStack's `isFetching && isStale` on the
shown read. Every consumer of `query.isFetching` (toolbar hairline, refresh-button spin, table "Updating…", pipeline
`aria-busy`, the table body's empty-state guard) then follows R4 with no edit of its own. The refresh button and saves
invalidate first, which marks the rows stale, so they always show. The hooks keep TanStack's raw `isFetching`
internally for the neighbouring-window preload gate. The result types' doc comments change with it.

### 4. A loading screen for dashboard home

The home page moves into a route group, `dashboard/(home)/page.tsx`, with its own `loading.tsx` rendering the existing
`DashboardHomePendingView` under `DataViewPending`. A `loading.tsx` beside the current `dashboard/page.tsx` would also
cover every route under `dashboard/` without its own (analytics, lead sources, detail pages) and show them the home
view. The URL doesn't change.

### 5. Schedule entry position

`ScheduleWeekView` positions its scroller in a `useLayoutEffect`, before paint: on mount today's column with
`behavior: 'instant'`, or the left edge when today is outside the shown week. A later change of week keeps the smooth
scroll to today and the Sunday/Friday alignment.

## Accepted behaviour

- The loading screen and the page are separate trees, so the view remounts once when the page commits: same rows,
  same layout; a scroll position set during that fraction of a second resets. The week view repositions before paint
  (§5).
- A refetch that fails while cached rows show leaves the rows and stops the hairline; the error UI stays for a read
  with no rows, as today.
- Past 30 s, the page's observer usually refetches before the boundary adopts the server's copy, so that navigation
  reads twice (TanStack #9610, fix PR #9968 unreleased). Rows still refresh in place.

## Out of scope

Everything in the deferred `2026-10-09` spec: per-family freshness, polling, server-side prefetch savings, detail
pages, analytics, lead sources.

## Verification

Playwright on the dev server (auth via `/api/dev/playwright-session`, no database writes). Dev doesn't prefetch
`loading.tsx`, so each check mounts the loading screen the way production does: it waits for the route's
`loading.tsx` chunk before the click, or it renders the pending view directly under the pending context.

1. Return to each in-scope route within 30 s: rows on the first frame after the click, one refetch, no hairline, rows
   replaced in place once the page commits (rows that did not change keep their DOM nodes through that refresh).
2. Return after 30 s: rows on the first frame, the hairline while the refetch runs, then it clears.
3. First visit in a fresh tab: skeletons, then rows.
4. Refresh button: the hairline and the spin show, then clear.
5. Dashboard home from another tab: the home view on the first frame; analytics and a detail page do not show it.
6. Schedule at 390 px: the scroller's `scrollLeft` is at today's column on the first frame and never animates on entry;
   Previous and Next still animate.

Then `pnpm tsc` and `pnpm lint`.

## Names (proposed; owner approval needed)

| Name | What it is |
|---|---|
| `useLoadingScreenRead` | §1's helper: a read's options inside or outside a loading screen, or nothing when uncached |
| `(home)` | §4's route group for dashboard home |

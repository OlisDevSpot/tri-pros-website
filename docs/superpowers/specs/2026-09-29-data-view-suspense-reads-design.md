# Data-view Suspense Reads — Design

**Date:** 2026-09-29 · **Status:** SHIPPED to local `main` 2026-09-30 (commits 3ec0db07, d93eca60, 90b7beef, 1cf8c2c9, 8f448f20, 34897959, 627762ad; interleaved with theme commits), not yet pushed. Harness sweep 29/29 PASS. Built from plan `docs/superpowers/plans/2026-09-29-data-view-suspense-reads.md`.

> **As built (supersedes §5.1's skeleton rows below):** there is no `RecordsPageSkeleton`. A `DataViewBoundary` renders its own children as its fallback inside `DataViewPendingContext`, so every loading state is the real view with no rows; the dashboard layout's cold-load fallback reuses these pending views per route. Result fields are `isPending` (fallback only), `isStale`, `isFetching`; `toDataTablePagination` passes `isFetching: isPending || isFetching` and a separate `isStale` (the table dims); `RecordsPageHeader` reads `total` + `isPending`. DataTable skeleton rows match each table's measured row height (`skeletonRowClassName`).

**Builds on** the shipped date-windows work (`2026-09-29-data-view-date-windows-design.md`, commits `b65e51f1..66e6be86`). Its ruling stays: a date window never draws another key's rows or a false "No events" while its own rows load.

**Touches the same hook as** the records bulk-actions plan (`docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md`), which moves projects onto `useDataViewQuery`. This spec keeps the hook's name and nearly all of its return shape, so that plan still applies; see §8.

**Already done in the working tree** (the pilot this spec generalizes; uncommitted): `@tanstack/react-query` 5.90.20 → 5.104.0; the dashboard home's proposal and project sections and snapshot strip read with `useSuspenseQuery`/`useSuspenseQueries` under per-section `HydrationErrorBoundary variant="section"` + `Suspense`; `useIsHydrating` stops the dashboard template's fade from hiding server HTML; `ServerAbilityProvider` seeds permissions from the server session.

---

## 1. Problem

Every data-view page prefetches its first read on the server (`prefetch()` in `src/trpc/lib/prefetch.ts`, streamed and dehydrated while pending by `HydrateClient`). Every consumer then reads it with a plain `useQuery` inside `useDataViewQuery` or `usePaginatedQuery`. Three consequences, all measured on 2026-09-29:

1. **The server HTML never holds data.** `useQuery` does not suspend, so the server renders the loading state and the rows appear only after the JS hydrates. The streamed prefetch is paid for but its main payoff, rows in the HTML, is never collected. `HydrateClient`'s Suspense fallback never shows on any page except campaigns overview.
2. **Hydration mismatches.** If the streamed data lands before the component hydrates, the client's first render has data while the server HTML has the loading state. This is TanStack/query#9399 (open, maintainer-confirmed; the `tryResolveSync` path in `hydrate()`), not something the 5.100+ fixes address. Measured on the dev server: `/dashboard/meetings` 3 of 3 loads (header count `+ 291`), `/dashboard` calendar ~1 in 3 (day dots). React then throws away the server HTML for that tree and re-renders on the client.
3. **The fix is documented.** TanStack's advanced-SSR streaming guide and tRPC's server-components guide both pair the streamed prefetch with `useSuspenseQuery`. Suspense is what synchronises the streamed data with hydration.

Research sources (Context7 + TanStack/tRPC/nuqs/react.dev docs + the installed library source) were collected on 2026-09-29; the verdict was that our query client, `prefetch`, `HydrateClient` and provider setup already match the canonical pattern. Only the read side deviates.

## 2. Decisions

| ID | Decision |
|---|---|
| **D1** | **Every data view reads with `useSuspenseQuery`.** Both `useDataViewQuery` and `usePaginatedQuery` suspend on their first read. |
| **D2** | **One hook, same name, same result shape** (minus the loading/error flags, §4). No parent/child split: the toolbar, header and table keep receiving one result object. Deferral (D3) keeps them rendering during changes, so only the very first read ever suspends. |
| **D3** | **Previous rows stay while a new key loads, via `useDeferredValue` on the URL state.** Not the nuqs `startTransition` option: with `shallow: true` (ours) nuqs pushes the new state synchronously, outside any transition (verified in nuqs 2.8.8 source), so the option does nothing here. Not a `startTransition` wrapper around each setter either: back/forward re-syncs nuqs from an effect, an urgent update no setter wrapper catches, and it would make the toolbar lag behind the click. |
| **D4** | **`isStale`** = the requested key's hash ≠ the shown key's hash (`hashKey` on the two `queryOptions` keys). Only data-affecting changes count. Tables dim the stale rows. A date window reports `window.isPending = isStale` and keeps drawing skeletons, never the old rows (the shipped ruling). |
| **D5** | **Every caller of either hook sits under a `DataViewBoundary`**: a Suspense boundary with a view-shaped skeleton, plus an error boundary with retry, that resets when the URL's search params change. |
| **D6** | **A server-rendered caller's page must prefetch the exact key.** A suspense read the server did not prefetch runs during SSR through `httpBatchLink` without the viewer's cookies. A dev-only guard in the hook reports it (§5.4). |
| **D7** | **`usePaginatedQuery` gets the same treatment in the same change** (proposals, projects, campaign leads). Retiring it stays with the records epic's migration onto `useDataViewQuery`. This spec does not block on that. *(Owner may flip this to "migrate those 3 tables first"; see §9 Q1.)* |
| **D8** | **Removed from both hooks:** the `enabled` option (`useSuspenseQuery` forbids it and `skipToken`; no caller passes it), `placeholderData: keepPreviousData` (no effect under suspense), and the `isLoading` / `isPlaceholderData` / `isError` / `error` result fields. |
| **D9** | **Adjacent-window prefetch** waits for `!isStale && !isFetching`. `isSuccess` is always true under suspense, and `isPlaceholderData` no longer exists. |
| **D11** | **Every skeleton matches the content it stands in for** (owner, 2026-09-29: the dashboard's skeletons are misaligned with its cards and the swap looks jarring). Each skeleton copies its content's outer box, padding, gaps, header row and item heights, measured from the rendered page, so the swap moves nothing. Applies to every skeleton this spec adds or touches, and to the dashboard's existing ones: `DashboardContentSkeleton`, `AppSidebarSkeleton`, the section skeletons and the calendar skeleton. |
| **D10** | **`isFetching` stays** (a background refetch after an invalidation or `refresh()`), and so does `refresh()`. With suspense a refetch never drops the rows. |

## 3. How it behaves

| Moment | Before | After |
|---|---|---|
| Document load, page prefetched | Skeleton in HTML (after the template fix), rows only after hydration; ~1/3–3/3 hydration mismatch | Server streams the finished rows into the HTML as the prefetch resolves; the `DataViewBoundary` skeleton shows until then; no mismatch possible |
| Filter, search, sort, page change | `keepPreviousData` shows old rows; toolbar shimmers | Same UX: old rows stay (dimmed), toolbar shows the new value immediately, no fallback |
| Date window step (or a filter on a date view) | Skeletons from `isPending` | Same: `isPending` from `isStale` |
| Back / forward | Old rows, then new | Same, and it no longer depends on nuqs internals |
| Invalidation / `refresh()` | `isFetching`, rows stay | Same |
| Read fails, no rows for this key yet | Inline `isError && rows.length === 0` branches per view | The error boundary shows "Try again"; it resets when the URL changes (back button, filter change) |
| Background refetch fails, rows present | Rows stay, error flag | Rows stay (TanStack only throws when the key has no data) |

## 4. The hook core

`useDataViewQuery` (`src/shared/dal/client/hooks/use-data-view-query.ts`), abbreviated:

```ts
const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
const shownState = useDeferredValue(urlState)

const requested = useDataViewState(urlState, config)   // filterSort + window: what the toolbar and nav show
const shown = useDataViewState(shownState, config)     // what the rows belong to

const requestedOptions = procedure.queryOptions({ ...toDataViewInput(requested.filterSort, requested.window, config), ...extra })
const shownOptions = procedure.queryOptions({ ...toDataViewInput(shown.filterSort, shown.window, config), ...extra })
const isStale = hashKey(requestedOptions.queryKey) !== hashKey(shownOptions.queryKey)

useServerPrefetchGuard(shownOptions.queryKey)          // dev-only, §5.4
useHydrationParityCheck(shownOptions.queryKey)         // existing dev check
const { data, isFetching } = useSuspenseQuery(shownOptions)

usePrefetchQueries(adjacentQueries(shownState), !isStale && !isFetching)
// setters unchanged: plain setUrlState(...)
// page clamp unchanged (data is always defined)
```

`useDataViewState` stands for the existing `deriveFilterSortState` + `deriveDataViewWindow` pair. It is not a new export; the name is illustrative.

- **Toolbar and window controls** are built from `requested`, so a chip, search box or month label updates on the click.
- **`rows`/`total`** come from `data` (the shown key).
- **The first render after hydration** has `shownState === urlState`, so `isStale` is false and the read is the prefetched key.
- `usePaginatedQuery` gets the same five changes: defer `urlState`, derive twice, `useSuspenseQuery` on the shown input, `isStale`, prefetch gate.

**Result type** (`DataViewQueryResult` / `PaginatedQueryResult` in `src/shared/dal/client/lib/types.ts`):

| Field | Change |
|---|---|
| `rows`, `total`, `refresh`, `filterSort`, `window` | unchanged (`window.isPending` now = `isStale` on date windows) |
| `isFetching` | unchanged meaning (background refetch) |
| `isStale` | **new**: the shown rows belong to an older key |
| `isLoading`, `isPlaceholderData`, `isError`, `error` | **removed** |

`fromPaginatedQuery` maps the new field set.

## 5. Surfaces

### 5.1 Shared pieces (new or changed)

| Piece | Change |
|---|---|
| `DataViewBoundary` (new, `src/shared/components/data-view-boundary.tsx`) | `QueryErrorResetBoundary` → `ErrorBoundary` (`resetKeys: [searchParams.toString()]`, section-sized fallback with "Try again") → `Suspense` (`fallback` prop). Reuses `HydrationErrorFallback`'s `section` variant. |
| `RecordsPageSkeleton` (new) | Header + toolbar + table-row skeleton, sized like `RecordsPageShell`, used by the records pages' boundaries. |
| `toDataTablePagination` | `isFetching: query.isFetching \|\| query.isStale` (was `\|\| isPlaceholderData`); `isError` removed. |
| `QueryToolbar` bar shimmer | `query.isFetching \|\| query.isStale`. |
| `RecordsPageHeader` | Drops the `isLoading` branch; `query` becomes `Pick<…, 'total'>`. |
| `RowCapNotice` | Unchanged (already reads `window.isPending`). |
| `HydrateClient` | Unchanged. Its page-level Suspense stays as the last-resort boundary. |
| `prefetch.ts` comment | Already corrected (names #9399). |

### 5.2 Callers

| # | Surface (route) | Caller (hook) | Boundary goes around | Skeleton | Server prefetch |
|---|---|---|---|---|---|
| 1 | Customers records (`/dashboard/customers`) | `CustomersTable` (`useDataViewQuery`) | `<CustomersTable />` in the page | `RecordsPageSkeleton` | ✅ |
| 2 | Meetings records (`/dashboard/meetings`) | `useMeetingsTable` in `MeetingsTable` | `<MeetingsTable>` in `MeetingsRecordsView` | `RecordsPageSkeleton` | ✅ |
| 3 | Proposals records | `PastProposalsTable` (`usePaginatedQuery`) | the table in its view | `RecordsPageSkeleton` | ✅ |
| 4 | Projects records | `PortfolioProjectsTable` (`usePaginatedQuery`) | the table in its view | `RecordsPageSkeleton` | ✅ |
| 5 | Schedule, meetings (`/dashboard/schedule`) | `ScheduleMeetingsCalendar` | the calendar in `ScheduleView` | calendar frame + `ScheduleCardSkeleton`s | ✅ |
| 6 | Schedule, activities (`?show=activities`) | `ScheduleActivitiesCalendar` | same | same | ✅ |
| 7 | Pipeline (`/dashboard/pipeline/[pipeline]`) | `CustomerPipelineView` | the view in the page | kanban-column skeleton (replaces its early-return `LoadingState`) | ✅ |
| 8 | Dashboard calendar (`/dashboard`) | `DashboardMeetingsHub` | the hub in `DashboardView` | `DashboardMeetingsCalendarSkeleton` | ✅ |
| 9 | Lead sources, one source | `LeadSourceCustomersSection` | the section | table-row skeleton | n/a: mounts only after the page's client read (no SSR) |
| 10 | Lead sources, all | `AllCustomersSection` | the section | table-row skeleton | n/a: same |
| 11 | Campaign leads (`/dashboard/campaigns?tab=leads`) | `CampaignsLeadsView` (`usePaginatedQuery`) | the view in its tab | `RecordsPageSkeleton` | ❌ **add**: the page prefetches only `tab === 'overview'`; a `?tab=leads` deep link renders the leads tab on the server |

Each caller deletes its own loading and error branches. Known ones:
- `schedule-meetings-calendar.tsx:99-101` and `schedule-activities-calendar.tsx:60-62` (`isError && rows.length === 0`, `isLoading`);
- `customer-pipeline-view.tsx:126-137` (`isInitialLoad` early return; `isSwitching` becomes `isStale || isFetching`) and `:167`;
- `dashboard-meetings-hub.tsx` (`isError` prop to the calendar);
- the two lead-source sections' `isLoading ? 'Loading…'` counts.

### 5.3 Stale styling

A stale table body or kanban dims with `opacity-60 transition-opacity` after a 200 ms delay, so a fast change never flickers. The toolbar shimmer covers it at once. Exact classes are settled in the plan's UI pass. The date views already have their skeletons.

### 5.4 Dev-only server prefetch guard

In both hooks: when rendering on the server (`isServer`) and `queryClient.getQueryState(shownOptions.queryKey)` is undefined, `console.error('[data-view] suspense read without a server prefetch: <path>')`. That turns D6 from a convention into a loud failure in dev. `checkHydrationParity` still covers client-side key drift.

## 6. Phases

A hook and all of its callers switch in the same commit. Once the hook suspends, a caller without its own boundary falls back to the nearest one above it. For the lead-source sections that is the dashboard layout's content slot, which would blank the whole page. Removing the fields (D8) in that same commit makes `tsc` list every remaining reader. No shims (owner rule: non-defensive migrations).

| Phase | What | Gate |
|---|---|---|
| **P0** | Shared pieces with no behaviour change: `DataViewBoundary`, `RecordsPageSkeleton`, the dev guard, `isStale` added to both result types (always false) | `tsc` + `lint` |
| **P1** | `useDataViewQuery` core (§4) + all 8 callers (#1, #2, #5–#10) + adapters (§5.1) + field removal. Build and check **customers (#1) first as the pilot**, then the rest, then commit. | §7 on every P1 surface |
| **P2** | `usePaginatedQuery` core + proposals (#3), projects (#4), campaign leads (#11, incl. the new prefetch) + `fromPaginatedQuery` | §7 on every P2 surface |
| **P3** | Memory and tracker updates; delete the dead `HydrateClient` default-fallback path only if no page relies on it | `tsc` + `lint` |

## 7. Verification (per surface, dev server, headless Chromium via the dev-session route)

1. **Rows in the server HTML:** `curl` the page with the session cookie; the streamed HTML contains the first rows' text (not just skeletons).
2. **Zero hydration errors in 5 consecutive fresh loads** (`pageerror` / console `Hydration failed`). Baseline today: meetings 3/3, dashboard ~1/3.
3. **Filter / search / sort / page change:** no fallback; old rows dimmed until the new ones arrive; toolbar shows the new value at once.
4. **Date window step:** skeletons, never the previous window's rows; the grid shows the requested window at once.
5. **Back / forward** after two filter changes: correct rows and no fallback.
6. **Error:** block the procedure's request for a new key (Playwright `route.abort`) → the section error with "Try again" → unblock + "Try again" recovers; the back button also recovers (`resetKeys`).
7. **Soft navigation** into the page from the sidebar: cached rows render at once, no fallback flash.
8. `pnpm tsc` and `pnpm lint` clean.

## 8. Interactions

- **Records bulk-actions plan:** projects moves onto `useDataViewQuery`. Under this spec its table sits under a `DataViewBoundary` and reads `isStale` instead of `isPlaceholderData`. If that plan lands first, projects (#4) moves from P2 to P1. Neither order breaks the other.
- **Date-windows ruling:** unchanged behaviour. `window.isPending` keeps its meaning; only its source changes (`isStale` instead of `isLoading || isPlaceholderData`). Its "false after an error" clause is now the boundary's job.
- **Soft navigations still re-run the page's prefetches** on the server (Next 15 re-renders dynamic pages). With cached client data, hydration keeps the rows and briefly sets `isFetching`, with no fallback flash (TanStack `hydrate()` only overwrites with newer data). The per-navigation DB reads are unchanged by this spec.
- **Production errors from a streamed prefetch** reach the client redacted (no `httpStatus`), so the client's retry predicate retries once. That retry is a real client fetch, which returns the true status and stops further retries. Accepted; no change.

## 9. Owner rulings (2026-09-29)

All three ruled as recommended: Q1 convert `usePaginatedQuery` in P2; Q2 dim after 200 ms; Q3 accept the two-step skeleton now. Q3's jarring swap is addressed by D11 (the layout skeleton matches the dashboard home, the most-opened page).

### Original questions

| Q | Question | Recommendation |
|---|---|---|
| **Q1** | `usePaginatedQuery`: convert it in P3 (D7), or migrate proposals / projects / campaign leads onto `useDataViewQuery` first and convert only one hook? | Convert in P3. It's mechanical, and those three tables get the win now. The migration stays with the records epic. |
| **Q2** | Stale dimming (§5.3): dim after 200 ms, or never dim and rely on the toolbar shimmer? | Dim after 200 ms. |
| **Q3** | On a document load the layout's generic `DashboardContentSkeleton` shows until the session resolves, then the page's view-shaped skeleton until its data streams. Accept the two-step, or make the layout skeleton route-aware later? | Accept now; revisit with the PWA cold-start work. |

## 10. Out of scope

Marketing-site entrance animations (their staged intros hide server HTML by design; a separate design call). Non-data-view `useQuery` reads that are not prefetched (they don't mismatch). Nav-click feedback (owner rejected). Any change to `prefetch`, the query client, or `HydrateClient` (already canonical).

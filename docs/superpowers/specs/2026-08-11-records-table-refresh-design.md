# Records-Table Refresh — Design

> **Status:** Design approved (2026-08-11). Not yet implemented.
> **Epic tracker:** `docs/plans/2026-08-11-records-table-refresh-epic.md` (roadmap + status + Phase-2 backlog).
> **Related:** `docs/codebase-conventions/query-toolkit.md`, `memory/pattern-pagination-toolkit.md`, `memory/pattern-tanstack-query-placeholder-data.md`.

This spec is the **why + the module interfaces**. The epic tracker is the roadmap; the phase plans are the executable steps. Read this before either.

## 1. Problem

Every records table in the app is built from three shared pieces — `usePaginatedQuery` → `QueryToolbar` → `DataTable`. There is **no way for a user to pull fresh server data** into a table without a full navigation/reload:

- `usePaginatedQuery` (`src/shared/dal/client/hooks/use-paginated-query.ts`) wraps TanStack `useQuery` but its `PaginatedQueryResult` (`src/shared/dal/client/lib/types.ts:100`) exposes only `isLoading` / `isFetching` / `isPlaceholderData` — **never `refetch`**. No consumer can trigger a refresh.
- `QueryToolbar` (`src/shared/components/query-toolbar/ui/query-toolbar.tsx`) renders a fetch shimmer but **has no refresh control**.
- There is **no pull-to-refresh** anywhere in the codebase (the only touch handlers in `DataTable` are column-resize handles).

Data goes stale after someone else edits a record, and the only recovery is a page reload — which also throws away scroll, column sizing, and URL-driven filter state churn.

## 2. Goal / scope

Add two refresh affordances to **all records tables** (every table going through the shared trio), wired **once** at the shared layer so all eight light up:

Meetings · Projects · Proposals · Activities · Campaign leads · Lead-source customers · All-customers · shared Customers table.

1. **A refresh button** in the `QueryToolbar` control cluster (beside Filters / Columns).
2. **Pull-to-refresh** (standard pull-down, **touch only**) on the table's scroll area.

Both trigger the **same refresh semantics**: invalidate the whole dataset for that table's tRPC procedure (all cached pages + the prefetched next page).

**Out of scope (documented as Phase-2 backlog in the epic, NOT built here):** the non-table query/kanban/dashboard contexts the inventory surfaced (agent-dashboard calendar/snapshot/action-queue, customer-pipeline kanban, lead-source analytics panels, etc.).

## 3. Design decisions (locked)

| # | Fork | Decision | Why |
|---|------|----------|-----|
| D1 | Refresh gesture | Standard **pull-down**, at `scrollTop === 0`, **touch only** | Platform-native (iOS/Android); desktop uses the button. |
| D2 | Button home | `QueryToolbar` control cluster (last item, beside Filters/Columns) | All 8 tables render `QueryToolbar`; it already holds the fetch state in context. Section-embedded tables (no page header) still get it. |
| D3 | Refresh semantics | **Invalidate the whole dataset** for the table's procedure (procedure-level, all inputs) | Correct after a foreign edit; also re-fetches the *stale prefetched next page* so paging forward isn't stale. |
| D4 | Where `refresh` lives | Surfaced from `usePaginatedQuery`, self-derived from its own query key | One capability, consumed by both affordances; zero per-table wiring for the mechanism. |
| D5 | Spin/await source | Button spins on `isFetching`; pull-to-refresh awaits the promise `refresh()` returns | `invalidateQueries` returns a promise that settles when refetches finish. |

## 4. The core capability: `refresh` on `usePaginatedQuery`

`usePaginatedQuery` gains a stable `refresh(): Promise<void>` and adds it to `PaginatedQueryResult<TRow>`.

**Mechanism (procedure-level invalidation, self-derived — no new caller args):**
The hook already holds `qc = useQueryClient()` and computes `baseOptions = queryOptionsFactory(queryInput)`. A tRPC query key is `[[...pathSegments], { input, type }]`; the **first element is the procedure path**, identical across every page/filter/sort input. Invalidating by that prefix matches all cached variants of exactly this procedure:

```ts
// inside usePaginatedQuery, after baseOptions is computed
const procedureKey = baseOptions.queryKey[0] as readonly string[]
const procedureKeyString = JSON.stringify(procedureKey) // stabilize the dep

const refresh = useCallback(
  () => qc.invalidateQueries({ queryKey: [procedureKey] }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- procedureKey deep-keyed via procedureKeyString
  [qc, procedureKeyString],
)
```

- Returns the `invalidateQueries` promise (settles when refetches complete) → pull-to-refresh awaits it; the button just spins on `isFetching`.
- Procedure-scoped: refreshing the Proposals table refreshes only proposal-list queries, not unrelated dashboards. (This is intentionally narrower than `use-invalidation.ts`'s cross-entity fan-out, which is for *mutations* that change related entities — a manual refresh should be self-scoped.)
- **Plan must verify the empirical key shape** (`console.log(baseOptions.queryKey)` once against `@trpc/tanstack-react-query`) before trusting `queryKey[0]` is the path array.

Added to the interface:
```ts
// PaginatedQueryResult<TRow> — new field, in the "Query state" group
/** Invalidate every cached page of this table's procedure and refetch. Resolves when refetches settle. */
refresh: () => Promise<void>
```

## 5. Affordance A — the refresh button (`QueryToolbar.RefreshButton`)

A new atom in `query-toolbar.tsx`, exported on the `QueryToolbar` compound and **added to the `Standard` preset** so `.Standard` tables get it free. Also available as a standalone slot for tables composing atomic slots.

- Reads `refresh` + `isFetching` from the existing `QueryToolbarProvider` context (the provider already passes the full `PaginatedQueryResult`, so only the interface/type gains the field).
- Visual: mirrors `FilterTrigger` / `ColumnsTrigger` exactly —
  - `<lg`: 44×44 icon-only `Button variant="outline"`, `RefreshCw` icon, `sr-only` label "Refresh".
  - `lg+`: `h-9` icon button (optionally icon+label), same outline silhouette so it reads as part of the control group.
- `RefreshCw` **spins while `isFetching`** (`animate-spin`), and the button is `disabled` during fetch (prevents hammering; the invalidate is a no-op mid-flight anyway).
- Placed **last** in the `Standard` `Bar`, after `ColumnsTrigger`, before `PageSize`'s `ml-auto` pushes rows-per-page to the right edge. (`PageSize` uses `lg:order-last`, so source order among the left cluster is preserved.)
- Respects `prefers-reduced-motion` (no spin; a subtle opacity pulse instead).

**Audit note for the plan:** confirm which of the 8 tables use `QueryToolbar.Standard` vs atomic slots. `.Standard` tables need **zero** change. Any atomic-slot table needs a one-line `<QueryToolbar.RefreshButton />` add.

## 6. Affordance B — pull-to-refresh

Two parts: a generic gesture hook + an indicator rendered inside `DataTable`, fed by an `onRefresh` prop threaded through the pagination adapter.

### 6.1 `usePullToRefresh(scrollRef, onRefresh, options?)`
New hook at `src/shared/components/data-table/hooks/use-pull-to-refresh.ts`.

- **Engage only when:** the event is touch, the scroll container's `scrollTop === 0` at `touchstart`, the drag is **downward** and **predominantly vertical** (`|dy| > |dx|`), and the `touchstart` target is **not** inside a column-resize handle (guard by a `data-resize-handle` attribute added to those handles, or `closest()` check).
- **Behavior:** track `pullDistance` with damping (e.g. `distance * 0.5`, capped). Past a `threshold` (~64px), release calls `onRefresh()`, holds the spinner until the returned promise settles, then animates back to 0. Below threshold, snaps back with no refetch.
- **Returns:** `{ pullDistance, isRefreshing, isThresholdReached }` for the indicator to render.
- **Reduced motion:** no elastic follow — show a static spinner once past threshold, hide on settle.
- **No-op when `onRefresh` is undefined** (non-paginated `DataTable` uses).

### 6.2 Indicator + wiring in `DataTable`
- `DataTable` gains an optional `onRefresh?: () => Promise<unknown> | void` prop.
- It calls `usePullToRefresh(scrollRef, onRefresh)` and renders a pull indicator (spinner in a translating pill) **above** the table inside the existing `scrollRef` overflow container. The indicator is absolutely positioned / transform-driven so it doesn't perturb table layout.
- The existing scroll container already has `overscroll-none touch-pan-x touch-pan-y`; the hook coexists with horizontal pan by the direction gate in 6.1.

### 6.3 Threading `onRefresh` to the table
`toDataTablePagination` (`src/shared/components/data-table/lib/to-data-table-pagination.ts`) adds `onRefresh: p.refresh` to the returned `DataTableServerPagination`, and `DataTableServerPagination` (`data-table/types.ts`) gains the optional field. `DataTable` reads it from `serverPagination.onRefresh` (or a dedicated top-level `onRefresh` prop — plan picks the cleaner of the two; threading through `serverPagination` means **every table using the adapter gets pull-to-refresh with no per-table change**).

## 7. Data flow

```
usePaginatedQuery ──exposes──▶ refresh(): Promise<void>        (invalidate procedure path)
        │                              │
        ├──▶ QueryToolbarProvider ctx ──▶ QueryToolbar.RefreshButton   (spins on isFetching)
        │
        └──▶ toDataTablePagination ──▶ DataTable(serverPagination.onRefresh) ──▶ usePullToRefresh (touch)
```

## 8. Module boundaries (what/how-used/depends-on)

- **`usePaginatedQuery.refresh`** — *what:* invalidate+refetch this table's whole dataset. *used by:* toolbar button (via context) + adapter (→ pull-to-refresh). *depends on:* `qc`, `baseOptions.queryKey`.
- **`QueryToolbar.RefreshButton`** — *what:* user-facing refresh control. *used by:* `Standard` preset + any atomic composition. *depends on:* toolbar context (`refresh`, `isFetching`), `useIsBelowLg`.
- **`usePullToRefresh`** — *what:* pure touch-gesture→refresh hook. *used by:* `DataTable`. *depends on:* a scroll-container ref + an `onRefresh` callback. Framework-agnostic of tables; reusable for the Phase-2 contexts.
- **`toDataTablePagination`** — *what:* adapter; now also forwards `onRefresh`. *used by:* all table consumers. *depends on:* `PaginatedQueryResult.refresh`.

## 9. Files touched

| File | Change |
|------|--------|
| `src/shared/dal/client/hooks/use-paginated-query.ts` | add `refresh` |
| `src/shared/dal/client/lib/types.ts` | add `refresh` to `PaginatedQueryResult` |
| `src/shared/components/query-toolbar/ui/query-toolbar.tsx` | new `RefreshButton` atom + add to `Standard` |
| `src/shared/components/data-table/hooks/use-pull-to-refresh.ts` | **new** gesture hook |
| `src/shared/components/data-table/ui/data-table.tsx` | `onRefresh` prop + pull indicator + `data-resize-handle` on handles |
| `src/shared/components/data-table/types.ts` | add `onRefresh?` to `DataTableServerPagination` |
| `src/shared/components/data-table/lib/to-data-table-pagination.ts` | forward `onRefresh: p.refresh` |
| (audit) atomic-slot table consumers | one-line `<QueryToolbar.RefreshButton />` if not on `.Standard` |

No server / DAL-server / schema / tRPC-router changes. No new dependencies (`RefreshCw` from `lucide-react` already used; motion via existing `motion/react` or CSS transforms).

## 10. Verification

This repo has **no test runner** (per the tRPC/CASL epics) — gate every slice on **`pnpm tsc && pnpm lint` green** plus manual verification:

- **`refresh` key shape:** one-time `console.log(baseOptions.queryKey)` in an uncommitted scratch to confirm `queryKey[0]` is the procedure path; then assert clicking refresh re-issues the network request (React Query devtools / Network tab).
- **Button:** on one table, confirm the icon spins during fetch, is disabled mid-fetch, and sits correctly in the cluster at both breakpoints.
- **Pull-to-refresh:** Playwright **mobile viewport** (or real device via `pnpm dev:mobile`) — pull down at top refreshes; horizontal pan and column-resize are unaffected; below-threshold release does nothing.
- **Regression:** the seven other tables render unchanged (button present, no layout shift).

## 11. Risks / to-verify at implementation

- **tRPC query-key shape (Phase 1).** The whole `refresh` mechanism rests on `queryKey[0]` being the procedure path array under `@trpc/tanstack-react-query`. Verify empirically before building on it; if the shape differs, fall back to passing a `queryFilter` from the call site (a bigger but bounded change).
- **Gesture vs. horizontal pan / column resize (Phase 3).** Wide tables pan horizontally in the same container; the direction gate + `scrollTop===0` + resize-handle guard must be airtight or pull-to-refresh will hijack legitimate scrolls. This is the load-bearing UX risk — verify on a real touch device, not just DevTools emulation.
- **iOS rubber-band overscroll.** `overscroll-none` is already set; confirm the native bounce doesn't fight the custom indicator on iOS Safari (a known caveat noted in `memory/feedback-pwa-safe-area.md` territory).
- **`isFetching` conflation.** The button spins on any fetch (pagination, search, refresh alike). Acceptable per D5; if it reads as noisy, a dedicated `isRefreshing` flag can be added later (YAGNI now).

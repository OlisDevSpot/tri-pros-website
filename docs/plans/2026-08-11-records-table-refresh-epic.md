# Records-Table Refresh Epic

> **Status:** Design approved (2026-08-11). Phase 1–3 planned. Not yet implemented.
> **Canonical design:** `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md`. This tracker does NOT restate the design — read the spec for the *why*, the module interfaces, and the locked decisions (D1–D5). This doc is the **roadmap + status**: which phase is where, what blocks what, and where each phase's executable plan lives.
> **Related:** `docs/codebase-conventions/query-toolkit.md`, `memory/pattern-pagination-toolkit.md`.

## Why this epic exists

Every records table (Meetings, Projects, Proposals, Activities, Campaign leads, Lead-source customers, All-customers, shared Customers) is built from the shared trio `usePaginatedQuery → QueryToolbar → DataTable`. **None can be manually refreshed** — the hook never exposes `refetch`, the toolbar has no refresh control, and there is no pull-to-refresh anywhere. Stale data after a foreign edit forces a full reload.

**Thesis:** surface one `refresh()` capability from `usePaginatedQuery` (procedure-level invalidation — spec §4), then consume it from two shared affordances — a toolbar button and a touch pull-to-refresh — so **all eight tables light up from one wiring**.

## Design decisions (locked — see spec §3)

D1 pull-down / touch-only · D2 button in the toolbar cluster · D3 invalidate the whole dataset · D4 `refresh` surfaced from the hook, self-derived from its query key · D5 button spins on `isFetching`, pull awaits the `refresh()` promise. **Do not re-litigate here.** If a phase surfaces a reason to reopen one, note it in that phase's plan and ping.

## Verification model (no test runner in this repo)

Consistent with the tRPC/CASL epics: this repo has **no test framework**. Every slice gates on **`pnpm tsc && pnpm lint` green + manual verification** (React Query Network/devtools for `refresh`; Playwright mobile viewport or `pnpm dev:mobile` for the gesture). Where a phase says "verify," construct the check by hand and record evidence in the phase plan's log. **Never run `pnpm build`.**

## Phase breakdown (the roadmap)

Each phase ships **green** and is independently reviewable. Phase 1 is foundational; **Phases 2 and 3 both depend only on Phase 1 and are independent of each other** (can be built in parallel / either order).

Legend: `AFK` = mergeable without live user decisions · `HITL` = needs a user ruling mid-phase.

- [x] **Phase 1 · AFK · blocked-by: none — Surface `refresh` from `usePaginatedQuery`.** ✅ Done 2026-08-11. `refresh()` invalidates `[queryKey[0]]` (procedure path). Key-shape verified from `@trpc/tanstack-react-query@11.9.0` `getQueryKeyInternal` (`[splitPath, {input,type}]`) + the repo's no-`keyPrefix` invariant asserted in `trpc/lib/prefetch.ts`/`trpc/DOCS.md:319`. tsc+lint green; `git grep` confirms no UI consumer yet.
  Add `refresh(): Promise<void>` to the hook (procedure-level `invalidateQueries` self-derived from `baseOptions.queryKey[0]`, spec §4) and to the `PaginatedQueryResult<TRow>` interface. **Wires nothing into the UI** — purely additive capability; behavior change is zero until Phase 2/3 consume it. First task **empirically verifies the tRPC query-key shape** (spec §11) before trusting `queryKey[0]`.
  - **Plan:** `docs/superpowers/plans/2026-08-11-records-refresh-phase-1-surface-refresh.md`
  - **AC:** `refresh` on the interface + hook; tsc+lint green; a scratch confirms `queryKey[0]` is the procedure path and that calling `refresh()` re-issues the network request; no UI consumer yet (`git grep` shows only the hook/type touched).

- [x] **Phase 2 · AFK · blocked-by: Phase 1 — `QueryToolbar.RefreshButton` + `Standard` preset.** ✅ Done 2026-08-11. Atom added + in `Standard`; 4 tables (proposals, projects, meetings, customers) inherit it from `.Standard`; 4 atomic-slot toolbars (leads-filter-bar, all-customers, lead-source-customers, activities) got an explicit `<QueryToolbar.RefreshButton />`. tsc+lint green. (Live spin/breakpoint check pending user inspection — no running app in session.)
  New `RefreshButton` atom mirroring `FilterTrigger`/`ColumnsTrigger` (44×44 mobile, `h-9` desktop, `RefreshCw` spinning on `isFetching`, disabled mid-fetch), added to the `Standard` preset and exported on the compound (spec §5). Audit the 8 tables: `.Standard` tables get it free; atomic-slot tables get a one-line add.
  - **Plan:** `docs/superpowers/plans/2026-08-11-records-refresh-phase-2-toolbar-button.md`
  - **AC:** button present on all 8 tables at both breakpoints; spins/disables on fetch; no layout shift in the cluster; tsc+lint green.

- [ ] **Phase 3 · AFK · blocked-by: Phase 1 — Pull-to-refresh (`usePullToRefresh` + `DataTable` indicator).**
  New generic `usePullToRefresh(scrollRef, onRefresh)` gesture hook (pull-down, touch-only, `scrollTop===0`, direction-gated, resize-handle-guarded — spec §6.1); a pull indicator in `DataTable`; `onRefresh` threaded through `toDataTablePagination` + `DataTableServerPagination` so every adapter-using table gets it automatically. Add `data-resize-handle` to the resize handles for the gesture guard.
  - **Plan:** `docs/superpowers/plans/2026-08-11-records-refresh-phase-3-pull-to-refresh.md`
  - **AC:** pull-down at top refreshes on a real/emulated touch device; horizontal pan + column resize unaffected; below-threshold release is a no-op; reduced-motion honored; tsc+lint green.

## Dependency graph

```
Phase 1 (surface refresh, unwired)
  ├─→ Phase 2 (toolbar button)      ┐  independent of each other —
  └─→ Phase 3 (pull-to-refresh)     ┘  either order / parallel
```

## Tracking

- **This doc** is the tracker (roadmap + status + plan pointers). Kept in-repo, not on GitHub. Check a phase's box when its plan lands green.
- **Per-phase executable plans** live in `docs/superpowers/plans/2026-08-11-records-refresh-phase-N-*.md`.
- **DOCS updates:** `docs/codebase-conventions/query-toolkit.md` gains a "Refresh" note (the `refresh` field + the two affordances) — land it with **Phase 3**, when the code matches. No ADR needed (no architectural axis changes).

## Phase-2 backlog — other "refetch fresh data in this context" sites (NOT in this epic)

The codebase inventory (2026-08-11) surfaced these query/kanban/dashboard contexts that also lack a manual refresh. **Captured here so nothing is lost; NOT built in this epic.** The `usePullToRefresh` hook from Phase 3 is deliberately generic so these can reuse it, and each has `refetch`/invalidation reachable via `use-invalidation.ts`.

**Highest-value next targets (mobile-relevant, high-churn):**
- Agent dashboard — `dashboard-meetings-calendar.tsx` (month-paged calendar), `dashboard-snapshot-strip.tsx` (KPI strip), `dashboard-action-queue.tsx` / `action-center-view.tsx`, project/proposal sections.
- Customer pipeline **kanban** — `customer-pipeline-view.tsx` (already has `refetch()` wired to mutations, but **no user-facing refresh control**).

**Secondary:**
- Campaigns admin — `campaigns-overview-view.tsx`, `source-policy-card.tsx`, `contact-attributes-readout.tsx`.
- Schedule — `schedule-view.tsx` (`useSuspenseQueries`).
- Lead sources admin — `lead-sources-view.tsx`, `source-detail.tsx`, `all-detail.tsx`, analytics panels, settings panel.
- Project management — `portfolio-grid-view.tsx` (card grid), `project-story-view.tsx`, `project-detail-sheet.tsx`.
- Meeting/proposal flow — `meeting-flow.tsx`, `persona-profile-panel.tsx`, `portfolio-step.tsx`, `proposal-media-manager.tsx`.

**Already have refresh-ish patterns to reuse (do NOT duplicate):**
- `NotionRefreshButton` (`landing/…/notion-refresh-button.tsx`) and the "Resync" button (`campaigns-admin/…/synced-campaigns-card.tsx`) — good visual templates, but both fire **mutations**, not query refetches.
- `use-invalidation.ts` — central per-domain invalidators to reuse from any refresh control.
- Auto-polling (`refetchInterval`) already exists in `edit-project-view.tsx` and `use-contract-status.ts` — no user-triggered equivalent.
- Realtime invalidation seam — `services/providers/upstash/realtime.ts` (push alternative to manual pull).

## Open risks / to-verify at implementation

- **Phase 1 — tRPC query-key shape.** Entire mechanism rests on `queryKey[0]` = procedure path under `@trpc/tanstack-react-query`. Verify empirically; fallback is passing a `queryFilter` from the call site.
- **Phase 3 — gesture vs horizontal pan / column resize.** Same scroll container pans horizontally and hosts resize handles; the `scrollTop===0` + direction + resize-handle gates must be airtight. Load-bearing UX risk — verify on a real touch device, not only DevTools.
- **Phase 3 — iOS rubber-band.** `overscroll-none` is set; confirm native bounce doesn't fight the custom indicator on iOS Safari.

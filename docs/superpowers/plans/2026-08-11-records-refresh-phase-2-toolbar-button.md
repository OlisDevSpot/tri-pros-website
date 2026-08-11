# Records-Table Refresh — Phase 2: `QueryToolbar.RefreshButton` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a refresh button to the `QueryToolbar` control cluster (beside Filters / Columns) that spins while fetching and calls `pagination.refresh()`, and put it in the `Standard` preset so all `.Standard` tables get it free.

**Architecture:** `QueryToolbar`'s `Root` already provides the full `PaginatedQueryResult` through `QueryToolbarProvider` — so `refresh` and `isFetching` are reachable from context (`useQueryToolbarContext()`). A new `RefreshButton` atom mirrors `FilterTrigger` / `ColumnsTrigger` (44×44 outline icon button on mobile, `h-9` on desktop). It is exported on the compound and rendered last in the `Standard` `Bar` (before `PageSize`, which floats right via `lg:order-last`).

**Tech Stack:** TypeScript, React, `lucide-react` (`RefreshCw`), Tailwind v4, the shared `Button` (`@/shared/components/ui/button`). No test runner.

## Global Constraints

- **Package manager: pnpm.** Path alias `@/` → `src/`.
- **No test runner exists.** Verify with `pnpm tsc && pnpm lint` (green) + manual browser checks. **Never run `pnpm build`.**
- **Blocked-by: Phase 1.** `PaginatedQueryResult.refresh` must exist. If `useQueryToolbarContext().refresh` doesn't type-check, Phase 1 isn't merged — stop.
- **Mirror the existing triggers exactly.** `RefreshButton`'s classes/breakpoint behavior must match `FilterTrigger`/`ColumnsTrigger` (`query-toolbar.tsx:164-175`) so the cluster stays visually uniform. Do not invent new sizing.
- **Staging:** stage explicitly by path. Do not push.
- **Canonical design:** `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md` §5. **Epic:** `docs/plans/2026-08-11-records-table-refresh-epic.md`.

---

### Task 1: Add the `RefreshButton` atom

**Files:**
- Modify: `src/shared/components/query-toolbar/ui/query-toolbar.tsx` (add the component near `ColumnsTrigger` ~`:288`; extend the `RefreshCw` import at `:8`; add to the compound export at `:802-811`)

**Interfaces:**
- Consumes: `useQueryToolbarContext()` → `{ refresh, isFetching }` (context already carries the full `PaginatedQueryResult`); `Button`, `cn`, `RefreshCw`.
- Produces: `QueryToolbar.RefreshButton` — a zero-prop atom.

- [ ] **Step 1: Extend the lucide import** at `:8`:

```ts
import { Columns3Icon, RefreshCw, SlidersHorizontal, XIcon } from 'lucide-react'
```

- [ ] **Step 2: Add the `RefreshButton` component** (place it right after the `ColumnsTrigger`/`ColumnsBody` block, before the `// ── Sheet helpers` divider at `:342`):

```tsx
// ── RefreshButton ────────────────────────────────────────────────────────────

/**
 * Manual refresh affordance. Mirrors `<FilterTrigger>` / `<ColumnsTrigger>`
 * sizing (44×44 on `<lg`, `h-9` icon button at `lg+`) so it reads as part of
 * the same control cluster. Spins the icon while any fetch is in flight and
 * disables itself mid-fetch to avoid hammering. Calls `pagination.refresh()`
 * (procedure-level invalidation — see spec §4/§5).
 */
function RefreshButton() {
  const { refresh, isFetching } = useQueryToolbarContext()
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void refresh()}
      disabled={isFetching}
      aria-label="Refresh"
      className="h-11 w-11 lg:h-9 lg:w-9 px-0 shrink-0 touch-manipulation"
    >
      <RefreshCw
        className={cn(
          'size-4 opacity-80 motion-safe:transition-transform',
          isFetching && 'motion-safe:animate-spin motion-reduce:opacity-50',
        )}
        aria-hidden
      />
      <span className="sr-only">Refresh</span>
    </Button>
  )
}
```

- [ ] **Step 3: Add it to the compound export** at `:802-811`:

```ts
export const QueryToolbar = Object.assign(Root, {
  Bar,
  Search,
  FilterTrigger,
  ColumnsTrigger,
  RefreshButton,
  PageSize,
  ChipRail,
  LiveStatus,
  Standard,
})
```

- [ ] **Step 4: Verify green** — `pnpm tsc && pnpm lint`

Expected: green. If `useQueryToolbarContext()` doesn't expose `refresh`, Phase 1 is not merged (see Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/query-toolbar/ui/query-toolbar.tsx
git commit -m "feat(query-toolbar): add RefreshButton atom"
```

---

### Task 2: Render `RefreshButton` in the `Standard` preset

**Files:**
- Modify: `src/shared/components/query-toolbar/ui/query-toolbar.tsx` (the `Standard` component, `:785-798`)

**Interfaces:**
- Consumes: `RefreshButton` (Task 1).

- [ ] **Step 1: Add `<RefreshButton />` to the `Standard` `Bar`**, after `ColumnsTrigger` and before `PageSize` (`PageSize` uses `ml-auto lg:order-last`, so it stays pinned right regardless of source order):

```tsx
function Standard({ searchPlaceholder, visibility }: StandardProps) {
  return (
    <>
      <Bar>
        <Search placeholder={searchPlaceholder} />
        <FilterTrigger />
        {visibility && <ColumnsTrigger visibility={visibility} />}
        <RefreshButton />
        <PageSize />
      </Bar>
      <ChipRail />
      <LiveStatus />
    </>
  )
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 3: Manual check** — `pnpm dev`, open a `.Standard` table (e.g. `/dashboard/proposals`). Confirm: (a) the refresh icon sits beside Filters/Columns at desktop width and as a 44×44 button on a narrow viewport; (b) clicking it spins the icon and re-fetches (rows re-resolve); (c) the button is disabled while fetching; (d) `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`) shows no spin, just the dimmed icon.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/query-toolbar/ui/query-toolbar.tsx
git commit -m "feat(query-toolbar): include RefreshButton in Standard preset"
```

---

### Task 3: Audit the 8 tables — add the button to any non-`.Standard` toolbar

Tables using `QueryToolbar.Standard` get the button from Task 2 for free. Tables composing atomic slots (`QueryToolbar.Bar` + explicit children) need a one-line add.

**Files (candidates — confirm by reading each):**
- `src/features/meeting-flow/ui/components/table/index.tsx`
- `src/features/project-management/ui/components/table/index.tsx`
- `src/features/proposal-flow/ui/components/table/index.tsx`
- `src/features/schedule-management/ui/components/activities-table.tsx`
- `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx`
- `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
- `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`
- `src/shared/entities/customers/components/customers-table.tsx`

- [ ] **Step 1: Find which tables do NOT use `.Standard`:**

```bash
git grep -l 'QueryToolbar' -- \
  'src/features/*/ui/**' 'src/shared/entities/customers/components/customers-table.tsx' \
  | xargs grep -L 'QueryToolbar.Standard'
```
Any file printed composes the toolbar with atomic slots and needs Step 2. Files NOT printed already have the button (done in Task 2).

- [ ] **Step 2: For each printed file**, read its `QueryToolbar.Bar` composition and insert `<QueryToolbar.RefreshButton />` as the last control before any `PageSize` slot (matching the `Standard` order). Example shape:

```tsx
<QueryToolbar.Bar>
  <QueryToolbar.Search />
  <QueryToolbar.FilterTrigger />
  {/* …any ColumnsTrigger… */}
  <QueryToolbar.RefreshButton />
  <QueryToolbar.PageSize />
</QueryToolbar.Bar>
```

If a printed file has no `QueryToolbar.Bar` (fully custom layout), place `<QueryToolbar.RefreshButton />` in the position that matches its filter/columns controls; note the deviation in the commit message.

- [ ] **Step 3: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 4: Manual check** — open each edited table and confirm the button appears in the cluster and refreshes. For `.Standard` tables, spot-check two (e.g. Proposals + one lead-sources section) to confirm no regression.

- [ ] **Step 5: Commit** (only if Step 1 printed any files; otherwise skip and note "all 8 use .Standard — no per-table change"):

```bash
git add <edited table files>
git commit -m "feat(records): add refresh button to atomic-slot tables"
```

---

### Task 4: Mark Phase 2 complete in the epic tracker

**Files:**
- Modify: `docs/plans/2026-08-11-records-table-refresh-epic.md` (Phase 2 checkbox)

- [ ] **Step 1: Check Phase 2's box**; note which tables (if any) needed the atomic-slot add vs. inherited it from `.Standard`.

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-08-11-records-table-refresh-epic.md
git commit -m "docs(records-refresh-epic): mark phase 2 complete"
```

---

## Self-Review

**Spec coverage (spec §5):** `RefreshButton` atom reading `refresh`+`isFetching` from context (Task 1) ✓; mirrors Filter/Columns sizing at both breakpoints (Task 1 classes) ✓; spins on `isFetching`, disabled mid-fetch (Task 1) ✓; reduced-motion honored (`motion-safe`/`motion-reduce`, Task 1) ✓; added to `Standard`, placed before `PageSize` (Task 2) ✓; exported on compound (Task 1 Step 3) ✓; 8-table audit for atomic-slot cases (Task 3) ✓.

**Placeholder scan:** none — the audit (Task 3) is a real discovery step with the exact grep and the exact insertion snippet, not a "handle the rest" hand-wave.

**Type consistency:** `RefreshButton` name identical in Task 1 (definition + export) and Task 2 (usage) and Task 3 (`QueryToolbar.RefreshButton`). Context field names `refresh` / `isFetching` match `PaginatedQueryResult` (Phase 1).

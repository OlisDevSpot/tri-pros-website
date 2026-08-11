# Records-Table Refresh — Phase 3: Pull-to-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard pull-down-to-refresh (touch only) to every records table by threading `refresh` through the pagination adapter into `DataTable`, where a generic gesture hook drives a pull indicator.

**Architecture:** A pure `usePullToRefresh(scrollRef, onRefresh)` hook binds non-passive touch listeners to the table's existing scroll container and returns `{ pullDistance, isRefreshing, isThresholdReached }`. It engages only from `scrollTop === 0`, on a downward, predominantly-vertical drag, and never from a column-resize handle (guarded by a `data-resize-handle` attribute). `onRefresh` rides on `DataTableServerPagination` (adapter forwards `p.refresh`), so every table using `toDataTablePagination` gets the gesture with no per-table change. A transform-driven indicator renders inside the bordered card.

**Tech Stack:** TypeScript, React (`useEffect`/`useRef`/`useState`, non-passive `touchmove`), `lucide-react` (`RefreshCw`), Tailwind v4. No test runner.

## Global Constraints

- **Package manager: pnpm.** Path alias `@/` → `src/`.
- **No test runner exists.** Verify with `pnpm tsc && pnpm lint` (green) + manual touch checks (Playwright mobile viewport, or a real device via `pnpm dev:mobile`). **Never run `pnpm build`.**
- **Blocked-by: Phase 1.** `PaginatedQueryResult.refresh` must exist (the adapter forwards it). Independent of Phase 2.
- **Touch only.** No mouse/pointer pull. Desktop refreshes via the Phase-2 button.
- **Do not break horizontal pan or column resize.** The scroll container (`data-table.tsx:394-402`) pans horizontally for wide tables and hosts resize handles. The engage gates (`scrollTop===0` + direction + `data-resize-handle`) are load-bearing — verify on a real touch surface (spec §11).
- **Reduced motion:** no elastic follow; static spinner past threshold. Use `motion-safe:` / `motion-reduce:`.
- **Staging:** stage explicitly by path. Do not push.
- **Canonical design:** `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md` §6. **Epic:** `docs/plans/2026-08-11-records-table-refresh-epic.md`.

---

### Task 1: Thread `onRefresh` through the pagination contract + adapter

**Files:**
- Modify: `src/shared/components/data-table/types.ts` (`DataTableServerPagination`, `:67-79`)
- Modify: `src/shared/components/data-table/lib/to-data-table-pagination.ts` (`:13-24`)

**Interfaces:**
- Consumes: `PaginatedQueryResult.refresh` (Phase 1).
- Produces: `DataTableServerPagination.onRefresh?: () => Promise<unknown> | void`.

- [ ] **Step 1: Add `onRefresh` to `DataTableServerPagination`** (after `isError` at `:78`):

```ts
  /** When true, the empty-state slot renders an error message instead of "no rows". */
  isError?: boolean
  /**
   * Invalidate + refetch the whole dataset for this table's procedure. Wired to
   * pull-to-refresh in DataTable. Forwarded from `usePaginatedQuery().refresh`.
   */
  onRefresh?: () => Promise<unknown> | void
```

- [ ] **Step 2: Forward it in the adapter** — add one line to `toDataTablePagination`'s return (after `isError: p.isError,` at `:22`):

```ts
    isError: p.isError,
    onRefresh: p.refresh,
```

- [ ] **Step 3: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/data-table/types.ts src/shared/components/data-table/lib/to-data-table-pagination.ts
git commit -m "feat(data-table): forward refresh through server-pagination adapter"
```

---

### Task 2: Write the `usePullToRefresh` gesture hook

**Files:**
- Create: `src/shared/components/data-table/hooks/use-pull-to-refresh.ts`

**Interfaces:**
- Consumes: a `RefObject<HTMLElement | null>` (the scroll container) + an `onRefresh` callback.
- Produces: `usePullToRefresh(scrollRef, onRefresh, options?): { pullDistance: number, isRefreshing: boolean, isThresholdReached: boolean }`; exported const `PULL_TO_REFRESH_THRESHOLD` (number).

- [ ] **Step 1: Write the hook**

```ts
'use client'

import type { RefObject } from 'react'

import { useEffect, useRef, useState } from 'react'

/** Pixels of (damped) pull past which release triggers a refresh. */
export const PULL_TO_REFRESH_THRESHOLD = 64
const MAX_PULL = 96
const RESISTANCE = 0.5

interface PullToRefreshState {
  pullDistance: number
  isRefreshing: boolean
  isThresholdReached: boolean
}

/**
 * Standard pull-down-to-refresh, TOUCH ONLY (spec §6.1). Binds non-passive
 * touch listeners to `scrollRef`. Engages only when the container is scrolled
 * to the very top, the drag is downward and predominantly vertical, and the
 * gesture did not start on a column-resize handle (`[data-resize-handle]`).
 * Past `PULL_TO_REFRESH_THRESHOLD`, release calls `onRefresh()` and holds the
 * spinner until the returned promise settles. No-op when `onRefresh` is
 * undefined (non-paginated DataTable uses).
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<unknown> | void) | undefined,
): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Gesture bookkeeping in refs — no re-render during move tracking.
  const startY = useRef(0)
  const startX = useRef(0)
  const engaged = useRef(false)
  const pull = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const refreshingRef = useRef(false)
  refreshingRef.current = isRefreshing

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onRefresh) {
      return
    }

    function setPull(next: number) {
      pull.current = next
      setPullDistance(next)
    }

    function handleTouchStart(e: TouchEvent) {
      if (refreshingRef.current) {
        return
      }
      const touch = e.touches[0]
      const target = e.target as HTMLElement | null
      // Engage only from the top, never from a resize handle.
      if (!touch || el!.scrollTop > 0 || target?.closest('[data-resize-handle]')) {
        engaged.current = false
        return
      }
      engaged.current = true
      startY.current = touch.clientY
      startX.current = touch.clientX
    }

    function handleTouchMove(e: TouchEvent) {
      if (!engaged.current || refreshingRef.current) {
        return
      }
      const touch = e.touches[0]
      if (!touch) {
        return
      }
      const dy = touch.clientY - startY.current
      const dx = touch.clientX - startX.current
      // Downward + predominantly vertical only; otherwise yield to native pan.
      if (dy <= 0 || Math.abs(dy) <= Math.abs(dx)) {
        engaged.current = false
        setPull(0)
        return
      }
      e.preventDefault() // we own the pull — suppress native rubber-band/scroll
      setPull(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    function handleTouchEnd() {
      if (!engaged.current) {
        return
      }
      engaged.current = false
      if (pull.current >= PULL_TO_REFRESH_THRESHOLD && onRefreshRef.current) {
        setIsRefreshing(true)
        setPull(PULL_TO_REFRESH_THRESHOLD)
        void Promise.resolve(onRefreshRef.current()).finally(() => {
          setIsRefreshing(false)
          setPull(0)
        })
      }
      else {
        setPull(0)
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [scrollRef, onRefresh])

  return {
    pullDistance,
    isRefreshing,
    isThresholdReached: pullDistance >= PULL_TO_REFRESH_THRESHOLD,
  }
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

Note: if lint flags the module-level `MAX_PULL` / `RESISTANCE` constants under a "no file-level constants" rule, follow the same escape the repo uses in `data-table.tsx` (which already declares module-level `COL_SIZE_KEY` / `CELL_BORDER`); the `pnpm lint` gate is authoritative — resolve to green before committing.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/data-table/hooks/use-pull-to-refresh.ts
git commit -m "feat(data-table): add usePullToRefresh gesture hook"
```

---

### Task 3: Tag the resize handles so the gesture skips them

**Files:**
- Modify: `src/shared/components/data-table/ui/data-table.tsx` (the two resize-handle `<div>`s at `:469-486` and `:489-506`)

**Interfaces:**
- Produces: `data-resize-handle` attribute on both resize handles (consumed by the hook's `closest('[data-resize-handle]')` guard).

- [ ] **Step 1: Add `data-resize-handle` to the non-last-column resize handle** (`:471`, the `<div onMouseDown={header.getResizeHandler()} …>`):

```tsx
                          <div
                            data-resize-handle
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onDoubleClick={() => header.column.resetSize()}
                            className="absolute right-0 translate-x-1/2 top-0 z-30 w-2 cursor-col-resize select-none touch-none"
                            style={{ height: isColResizing ? 9999 : '100%' }}
                          >
```

- [ ] **Step 2: Add `data-resize-handle` to the last-column resize handle** (`:491`, the second `<div onMouseDown={header.getResizeHandler()} …>`) the same way.

- [ ] **Step 3: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/data-table/ui/data-table.tsx
git commit -m "feat(data-table): tag resize handles for pull-to-refresh guard"
```

---

### Task 4: Wire the hook + indicator into `DataTable`

**Files:**
- Modify: `src/shared/components/data-table/ui/data-table.tsx` (import at `:14`; call the hook near the other scroll refs ~`:140`; add `relative` to the card container `:393`; render the indicator inside it)

**Interfaces:**
- Consumes: `usePullToRefresh`, `PULL_TO_REFRESH_THRESHOLD` (Task 2), `serverPagination.onRefresh` (Task 1), `RefreshCw`.

- [ ] **Step 1: Extend imports.** Add `RefreshCw` to the lucide import (`:14` currently `import { PinIcon } from 'lucide-react'`):

```ts
import { PinIcon, RefreshCw } from 'lucide-react'
```

Add the hook import alongside the other data-table imports (after the pagination import ~`:20`):

```ts
import { PULL_TO_REFRESH_THRESHOLD, usePullToRefresh } from '@/shared/components/data-table/hooks/use-pull-to-refresh'
```

- [ ] **Step 2: Call the hook.** After the `scrollRef` declaration (`:140`) and its width/scroll effects, add:

```ts
  // -- Pull-to-refresh (touch) ----------------------------------------------
  const { pullDistance, isRefreshing } = usePullToRefresh(scrollRef, serverPagination?.onRefresh)
```

- [ ] **Step 3: Make the card container positioned.** Add `relative` to the container at `:393`:

```tsx
      <div className="relative grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden">
```

- [ ] **Step 4: Render the indicator** as the first child inside that container (immediately after the opening `<div …>` from Step 3, before the `scrollRef` div at `:394`):

```tsx
        {serverPagination?.onRefresh && (pullDistance > 0 || isRefreshing) && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
            style={{
              transform: `translateY(${Math.max(pullDistance - 20, 0)}px)`,
              opacity: Math.min(pullDistance / PULL_TO_REFRESH_THRESHOLD, 1),
            }}
          >
            <div className="mt-1 rounded-full border border-border/50 bg-background p-1.5 shadow-sm">
              <RefreshCw
                className={cn(
                  'size-4 text-muted-foreground',
                  isRefreshing && 'motion-safe:animate-spin',
                )}
              />
            </div>
          </div>
        )}
```

- [ ] **Step 5: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 6: Manual touch check** — start `pnpm dev:mobile` (or Playwright at a mobile viewport), open a records table (e.g. Proposals). Confirm:
  - At the top, dragging **down** reveals the spinner following the finger; releasing past ~64px refreshes (rows re-resolve, spinner holds then retracts).
  - Releasing **below** threshold snaps back with no refetch.
  - **Horizontal** drag on a wide table still pans columns (no hijack).
  - Dragging a **column-resize handle** resizes as before (no pull).
  - When already scrolled down, pulling does nothing until back at the top.
  - `prefers-reduced-motion: reduce` shows a static (non-spinning) indicator.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/data-table/ui/data-table.tsx
git commit -m "feat(data-table): pull-to-refresh indicator + gesture wiring"
```

---

### Task 5: Update the query-toolkit convention doc + mark the epic complete

**Files:**
- Modify: `docs/codebase-conventions/query-toolkit.md` (add a short "Refresh" note)
- Modify: `docs/plans/2026-08-11-records-table-refresh-epic.md` (Phase 3 checkbox)

- [ ] **Step 1: Add a "Refresh" subsection** to `query-toolkit.md` documenting: `usePaginatedQuery().refresh` (procedure-level invalidation); the toolbar `QueryToolbar.RefreshButton` (in `Standard`); and pull-to-refresh (touch, auto-wired via `toDataTablePagination`). Keep it to a short paragraph + the one-line API — the spec is canonical, this is a pointer.

- [ ] **Step 2: Check Phase 3's box** in the epic and note verification evidence (which table you touch-tested, on device vs. emulator).

- [ ] **Step 3: Commit**

```bash
git add docs/codebase-conventions/query-toolkit.md docs/plans/2026-08-11-records-table-refresh-epic.md
git commit -m "docs(query-toolkit): document records-table refresh; mark phase 3 complete"
```

---

## Self-Review

**Spec coverage (spec §6):** `onRefresh` on `DataTableServerPagination` + adapter forwarding `p.refresh` (Task 1) ✓; generic `usePullToRefresh` with `scrollTop===0` + direction + resize-handle gates, damping, threshold, promise-await, no-op-when-undefined, reduced-motion (Task 2) ✓; `data-resize-handle` on both handles (Task 3) ✓; indicator inside the scroll card, transform-driven, touch-only via the hook (Task 4) ✓; every adapter-using table gets it automatically (Task 1 threading, no per-table change) ✓; convention doc note (Task 5, spec §"DOCS updates") ✓.

**Placeholder scan:** none — the hook and indicator are given in full; the manual check (Task 4 Step 6) enumerates each gate rather than saying "test it works."

**Type consistency:** `usePullToRefresh(scrollRef, onRefresh)` returning `{ pullDistance, isRefreshing, isThresholdReached }` identical in Task 2 (definition) and Task 4 (destructures `pullDistance`, `isRefreshing`). `PULL_TO_REFRESH_THRESHOLD` exported in Task 2, imported in Task 4. `onRefresh?: () => Promise<unknown> | void` identical across Task 1 (type), Task 2 (param), Task 4 (`serverPagination?.onRefresh`). Adapter field `onRefresh: p.refresh` matches `PaginatedQueryResult.refresh` from Phase 1.

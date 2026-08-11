# Records-Table Refresh — Phase 1: Surface `refresh` from `usePaginatedQuery` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `refresh(): Promise<void>` capability to `usePaginatedQuery` that invalidates and refetches every cached page of the table's tRPC procedure — additive only, no UI consumer yet.

**Architecture:** The hook already holds `useQueryClient()` and computes `baseOptions = queryOptionsFactory(queryInput)`. A tRPC query key is `[[...pathSegments], { input, type }]`; invalidating by the first element (the procedure path) matches every page/filter/sort variant. `refresh` wraps `qc.invalidateQueries({ queryKey: [procedureKey] })` and returns its promise. Phases 2 and 3 consume this field; Phase 1 wires nothing into the UI.

**Tech Stack:** TypeScript, `@tanstack/react-query` (`keepPreviousData`, `useQueryClient`), `@trpc/tanstack-react-query`, pnpm. No test runner.

## Global Constraints

- **Package manager: pnpm.** Path alias `@/` → `src/`.
- **No test runner exists.** Verify every task with `pnpm tsc && pnpm lint` (both green) plus the manual/scratch checks noted. Do **not** add vitest/jest or commit a verification script. **Never run `pnpm build`.**
- **Phase 1 wires NOTHING into the UI.** Only `use-paginated-query.ts` and `client/lib/types.ts` change. Zero behavior change is an acceptance criterion (verified by `git grep`).
- **Staging:** stage explicitly by path (`git add <path>`), never `git add -A`. Do not push.
- **Canonical design:** `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md` §4, §11. **Epic:** `docs/plans/2026-08-11-records-table-refresh-epic.md`.

---

### Task 1: Verify the tRPC query-key shape (scratch, uncommitted)

The whole mechanism rests on `baseOptions.queryKey[0]` being the procedure path array. Confirm empirically before building on it (spec §11).

**Files:**
- Create (scratchpad, **uncommitted**): `<scratchpad>/verify-query-key.ts`

- [ ] **Step 1: Read the current hook** to locate where `baseOptions` is computed (`src/shared/dal/client/hooks/use-paginated-query.ts:134` — `const baseOptions = queryOptionsFactory(queryInput)`).

- [ ] **Step 2: Add a one-line temporary log** right after line 134 (do NOT commit):

```ts
// TEMP — remove before commit
if (typeof window !== 'undefined') console.log('[refresh] queryKey', baseOptions.queryKey)
```

- [ ] **Step 3: Run the app and open any records table** (`pnpm dev`, then e.g. `/dashboard/proposals`). In the browser console, confirm the shape is `[[<router>, <procedure>...], { input, type: 'query' }]` — i.e. `queryKey[0]` is a string array naming the procedure path.

- [ ] **Step 4: Record the observed shape** in this plan's verification log below, then **remove the temporary log line**. Confirm `git diff` shows the hook back to its original state.

**Verification log (fill in):**
```
observed queryKey = ____________________
queryKey[0] is the procedure path? (Y/N) ___
```

If the shape differs (e.g. `queryKey[0]` is not the path array), STOP and ping — the fallback is to pass a `queryFilter` from the call site (a bounded but larger change across the 8 tables), which changes this plan.

---

### Task 2: Add `refresh` to the `PaginatedQueryResult` interface

**Files:**
- Modify: `src/shared/dal/client/lib/types.ts` (the `PaginatedQueryResult<TRow>` interface, `:100-142`)

**Interfaces:**
- Produces: `PaginatedQueryResult<TRow>.refresh: () => Promise<void>` — consumed by the toolbar button (Phase 2, via context) and the adapter (Phase 3).

- [ ] **Step 1: Add the field** to the "Query state" group of the interface (after `error: unknown` at `:141`):

```ts
  // -- Refresh --
  /**
   * Invalidate every cached page of this table's tRPC procedure and refetch
   * the active page(s). Resolves when the refetches settle — pull-to-refresh
   * awaits this; the toolbar button spins on `isFetching`. See spec §4.
   */
  refresh: () => Promise<void>
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

Expected: `tsc` now reports an error in `use-paginated-query.ts` (the returned object doesn't yet satisfy the interface — `refresh` missing). That is the expected red state; Task 3 makes it green. If `tsc` reports errors anywhere else, the field was added wrong.

- [ ] **Step 3: Commit**

```bash
git add src/shared/dal/client/lib/types.ts
git commit -m "feat(query-toolkit): add refresh to PaginatedQueryResult interface"
```

---

### Task 3: Implement `refresh` in `usePaginatedQuery`

**Files:**
- Modify: `src/shared/dal/client/hooks/use-paginated-query.ts` (after `baseOptions` at `:134`; add to the return object at `:250-275`)

**Interfaces:**
- Consumes: `qc` (`useQueryClient()`, already in scope at `:77`), `baseOptions.queryKey` (`:134`), `useCallback` (already imported at `:9`).
- Produces: `refresh` in the returned `PaginatedQueryResult`.

- [ ] **Step 1: Derive the procedure key** immediately after `const baseOptions = queryOptionsFactory(queryInput)` (`:134`):

```ts
  // -- Refresh (procedure-level invalidation) ------------------------------
  // The first query-key element is the tRPC procedure path — identical across
  // every page/filter/sort input — so invalidating by it matches ALL cached
  // pages of this table (incl. the prefetched next page). See spec §4.
  const procedureKey = baseOptions.queryKey[0] as readonly string[]
  const procedureKeyString = JSON.stringify(procedureKey)
  const refresh = useCallback(
    async () => {
      await qc.invalidateQueries({ queryKey: [procedureKey] })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- procedureKey deep-keyed via procedureKeyString (its value is stable across renders)
    [qc, procedureKeyString],
  )
```

- [ ] **Step 2: Add `refresh` to the return object** — in the `// -- Query state --` region of the returned object (alongside `isError`, `error` at `:273-274`):

```ts
    isError,
    error,
    refresh,
  }
```

- [ ] **Step 3: Verify green** — `pnpm tsc && pnpm lint`

Expected: green. The interface (Task 2) and the implementation now agree.

- [ ] **Step 4: Manual behavior check (scratch, no commit)**

Run `pnpm dev`, open a records table, open React Query devtools (or the Network tab). Temporarily wire a throwaway button in one table body — e.g. in `src/features/proposal-flow/ui/components/table/index.tsx` add `<button onClick={() => pagination.refresh()}>refresh</button>` inside the returned fragment — click it, and confirm the list query re-issues its network request (status flips to fetching, rows re-resolve). **Remove the throwaway button**; confirm `git diff` shows only the two intended files changed.

- [ ] **Step 5: Confirm zero UI wiring**

Run:
```bash
git grep -n '\.refresh(' -- 'src/**' | grep -v 'use-paginated-query.ts'
```
Expected: **no output** (nothing consumes `refresh` yet — Phases 2/3 add consumers).

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/client/hooks/use-paginated-query.ts
git commit -m "feat(query-toolkit): surface refresh() from usePaginatedQuery"
```

---

### Task 4: Mark Phase 1 complete in the epic tracker

**Files:**
- Modify: `docs/plans/2026-08-11-records-table-refresh-epic.md` (Phase 1 checkbox)

- [ ] **Step 1: Check Phase 1's box** and append a one-line note under its bullet: `Phase 1 verified: refresh() invalidates procedureKey; observed queryKey shape = <paste from Task 1 log>.`

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-08-11-records-table-refresh-epic.md
git commit -m "docs(records-refresh-epic): mark phase 1 complete"
```

---

## Self-Review

**Spec coverage (spec §4):** `refresh` on interface (Task 2) ✓; procedure-level invalidation self-derived from `queryKey[0]` (Task 3) ✓; returns the invalidate promise (Task 3 `async/await`) ✓; empirical key-shape verification (Task 1, spec §11) ✓; "wires nothing into UI" (Task 3 Step 5 grep) ✓.

**Placeholder scan:** none. The one verification-log blank in Task 1 is an intentional evidence field, not a code placeholder.

**Type consistency:** `refresh: () => Promise<void>` identical in Task 2 (interface) and Task 3 (implementation returns `async () => { await ... }`, which is `() => Promise<void>`). `procedureKey` / `procedureKeyString` names consistent within Task 3.

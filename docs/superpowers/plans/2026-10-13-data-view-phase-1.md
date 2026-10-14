# Data-view phase 1 (DV3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `DataView` compound and move the three records tables (meetings, projects, proposals) onto it, deleting the hand-rolled chrome it replaces.

**Architecture:** One compound under `src/shared/components/data-view/` (root + `Bar`, `Title`, `Count`, `Toolbar`, `Body`, `Empty`, `Boundary`) reads one widened query from context. `EntityRecordsTable` is rebuilt on the parts, so meetings and projects move with no change of their own; proposals composes the parts by hand and its route moves onto the loading-screen rule. `DataTable` loses its own stale dim and in-table empty row, because `Body` now owns both.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query 5, nuqs, Tailwind v4, tsx for throwaway checks, Playwright for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-data-view-surface-design.md` (approved 2026-10-14). Tracker: `docs/plans/2026-10-12-data-views-epic.md` (DV3). Read both before Task 1.

## Global Constraints

- Work on local main; no branch. The tree is shared: no `git stash`, `checkout <ref> -- …`, `restore` (beyond your own files), `reset`, `clean`; no `git add -A` / `.` / `-u`. Commit only with `git commit -m "…" -- <explicit paths>`; never `--amend`. If a commit comes out wrong, STOP and report. Run `git show --stat HEAD` after each commit.
- Before editing a file: `git status --short <file>`. If it holds changes that aren't yours, STOP and report.
- Never `pnpm build`. Verify with `pnpm tsc` and `pnpm exec eslint <files>` (the whole `pnpm lint` at the end). No database writes, dev included. Never print `DEV_LOGIN_SECRET`.
- Comments say why, never what. No plan, spec, task or tracker citations in code.
- Any name not in this plan or the spec's §2 comes to the owner first. Names already confirmed are listed under "Owner confirms" below.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes ~110 s: give `git commit` a 300 s timeout.
- Keep `projects-records-table.tsx`'s `headerActions` prop and its JSX exactly as they are (#285 part 4 wraps that node in `<Can>`). `EntityRecordsTable`'s props (`title`, `entityName`, `searchPlaceholder`, `headerActions`, `table`) do not change.
- Same rows, same URL keys, same controls on every migrated view (spec §1 non-goals).
- `entityName` on `DataView` is the plural ("meetings"); `DataTable`'s and `useEntityTable`'s stay singular.
- The stale dim is exactly `transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200`. A refresh (`isFetching`) never changes opacity; it only sets `aria-busy`.
- `DataView.Body` never clips horizontally (no `overflow-hidden`, `overflow-x-*`, `overflow-clip` on it); bodies bleed through it (`docs/codebase-conventions/app-shell.md#page-insets-and-bleed`).
- Shipping to prod is the owner's (`pnpm hotfix`). Edit only the DV3 row in `docs/plans/2026-10-12-data-views-epic.md`.

## Owner confirms (answered 2026-10-14: every recommendation accepted)

1. **New names this plan adds** (beyond spec §2): component functions `DataViewRoot`, `DataViewTitle`, `DataViewCount`, `DataViewToolbar`, `DataViewBody`, `DataViewEmpty` (the spec's `Root`/`Title`/… as exported functions, after `QueryToolbarRoot`); context `DataViewContext` + type `DataViewContextValue`; the boundary bit `DataViewBoundaryContext`; `data-slot` values `data-view-body`, `data-view-count`; view `ProposalsRecordsView` (`src/features/records-management/ui/views/proposals-records-view.tsx`, beside `MeetingsRecordsView`/`ProjectsRecordsView`); workspace `.superpowers/sdd/2026-10-13-data-view-phase-1/` with `check-data-view-parts.tsx` and `check-states.mjs`. **Recommend: yes.**
2. **Campaign leads keeps its empty message and stale dim.** Removing them from `DataTable` (spec §4) would strip both from campaign leads for good, because campaign leads never moves onto the parts (spec non-goal, D57). The recommendation is that Task 3 wraps its table in `DataView` + `DataView.Body empty`, which is about 6 lines; its `LeadsFilterBar` stays as it is. The alternative is accepting a blank table body and no dim there. **Recommend: wrap it.**
3. **Customers page and the two lead-sources panes between DV3 and DV4.** They still render `DataTable` outside a data view until R2 Part 2 rewrites them, so on local main they lose the stale dim and the "No customers match" row until DV4 lands. Wrapping them now would move them twice (D14). **Recommend: accept on local main, and ship DV3 to prod together with DV4** (or accept the gap on prod if DV3 ships alone).
4. **Docs that cite the moved boundary path.** `@/shared/components/data-view-boundary` moves into `data-view/ui/boundary.tsx`. Eleven docs cite the old path (`grep -rln "data-view-boundary" docs CONTEXT.md`); most are historical, and the R2 Part 2 plan is re-checked at DV4 anyway. **Recommend: don't edit them here; the DV3 tracker row names the move so DV4's re-check catches it.**
5. **Records tracker ledger §3.1 "DataView parts" column** (spec §6, §10) lives in `docs/plans/2026-09-26-records-management-epic.md`, which this plan may not edit. **Recommend: defer it to the owner's next pass on that tracker.**

## Review Focus

1. **A dimmed table on a phone:** the dim moves from `<Table>` up to `Body`, so `Body`'s opacity now makes the stacking context. The sticky header, the frozen first column and the dock fade must look the same while rows are stale. *Pinned by:* Task 5's `check-states.mjs` stale screenshot at 390 px, and `layout-probe.mjs` passing on the three routes.
2. **A search that matches nothing:** `Body` shows `Empty` ("No meetings match these filters") in place of the whole table, and the toolbar stays live so clearing the search brings the rows back. *Pinned by:* Task 2's unit check (filtered copy) and Task 5's `check-states.mjs` empty → clear → rows.
3. **A read that fails:** the error fallback shows the retry above a row-less view, with no count and no `Empty`, and changing the search escapes it. *Pinned by:* Task 2's unit check (`Count` renders nothing under `'error'`, `Body` keeps its children while `isPending`) and Task 5's `check-states.mjs` error case.
4. **A loading screen with a cached empty result:** `Empty` shows at once, the same as the page would (spec §7); a loading screen with nothing cached shows the table skeleton and `Loading…`, never `Empty`. *Pinned by:* Task 2's unit check (pending + no rows → children and `Loading…`; not pending + no rows → `Empty`).
5. **The pagination footer during a stale load:** it dims with the rows (it sits inside `Body`), but its buttons must still work, because the rule blocks no pointer events on tables. *Pinned by:* Task 5's `check-states.mjs` stale case, which asserts `pointer-events` is not `none` on the body.

---

## Preflight (controller, before Task 1)

- [ ] **P1: Confirm the dev server and a clean index.**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
git diff --cached --stat          # must print nothing
ss -ltnp | grep -E ':(3000|3001)\b'   # the dev server must be listening on PORT (.env.local), never rm -rf .next while it runs
```

- [ ] **P2: Create the workspace and copy the carried checks** (tracker §6; the source directory is git-ignored and may be cleaned later).

```bash
W=.superpowers/sdd/2026-10-13-data-view-phase-1
mkdir -p $W
cp .superpowers/sdd/2026-10-12-instant-tab-return/check-lib.mjs \
   .superpowers/sdd/2026-10-12-instant-tab-return/check-return.mjs \
   .superpowers/sdd/2026-10-12-instant-tab-return/check-error-return.mjs \
   .superpowers/sdd/2026-10-12-instant-tab-return/check-home.mjs \
   .superpowers/sdd/2026-10-12-instant-tab-return/check-week-entry.mjs \
   .superpowers/sdd/2026-10-12-instant-tab-return/tsconfig.json $W/
echo docs/superpowers/plans/2026-10-13-data-view-phase-1.md > $W/plan-path
```

- [ ] **P3: Baselines (before any code change).**

```bash
W=.superpowers/sdd/2026-10-13-data-view-phase-1
for p in meetings projects proposals; do node scripts/perf/records-probe.mjs /dashboard/$p > $W/probe-before-$p.txt 2>&1; done
timeout 590 node $W/check-return.mjs > $W/return-before.txt 2>&1; echo "exit $?"
timeout 400 node $W/check-error-return.mjs > $W/error-return-before.txt 2>&1; echo "exit $?"
node scripts/perf/layout-probe.mjs > $W/layout-before.txt 2>&1; echo "exit $?"
```

Expected: every check prints PASS and exits 0. Record any pre-existing FAIL in `$W/progress.md` before Task 1; it is not this plan's to fix.

---

### Task 1: Move the boundary and pending view into `data-view/`, and give the boundary its bit

**Files:**
- Create: `src/shared/components/data-view/lib/context.ts`
- Create: `src/shared/components/data-view/ui/boundary.tsx` (from `src/shared/components/data-view-boundary.tsx`)
- Create: `src/shared/components/data-view/ui/pending.tsx` (from `src/shared/components/data-view-pending.tsx`)
- Delete: `src/shared/components/data-view-boundary.tsx`, `src/shared/components/data-view-pending.tsx`
- Modify (import path only): every file `grep -rln "@/shared/components/data-view-boundary'\|@/shared/components/data-view-pending'" src` lists. At HEAD `2ef151415` that is:
  - boundary: `src/features/campaigns-admin/ui/views/campaigns-view.tsx`, `src/features/records-management/ui/views/meetings-records-view.tsx`, `src/features/records-management/ui/views/projects-records-view.tsx`, `src/features/schedule-management/ui/views/schedule-view.tsx`, `src/features/agent-dashboard/ui/views/dashboard-view.tsx`, `src/features/lead-sources-admin/ui/components/source-detail.tsx`, `src/features/lead-sources-admin/ui/components/all-detail.tsx`, `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx`, `src/features/agent-dashboard/ui/components/pipeline-route-pending-view.tsx`, `src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx`, `src/app/(frontend)/dashboard/(records)/customers/page.tsx`, `src/app/(frontend)/dashboard/(records)/proposals/page.tsx`, `src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx`, `src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx`
  - pending: `src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx`, `src/features/agent-dashboard/ui/components/launch-shell.tsx`, and the `loading.tsx` of `(home)`, `schedule`, `(records)/meetings`, `(records)/projects`, `(records)/proposals`, `(records)/customers`, `pipeline/[pipeline]`

**Interfaces:**
- Produces: `DataViewContext`, `DataViewContextValue`, `useDataView()`, `DataViewBoundaryContext` from `@/shared/components/data-view/lib/context`; `DataViewBoundary` from `@/shared/components/data-view/ui/boundary`; `DataViewPending` from `@/shared/components/data-view/ui/pending`. Export names `DataViewBoundary` and `DataViewPending` are unchanged.

- [ ] **Step 1: Check every file is yours to edit.**

```bash
git status --short src/shared/components/data-view-boundary.tsx src/shared/components/data-view-pending.tsx $(grep -rln "@/shared/components/data-view-boundary'\|@/shared/components/data-view-pending'" src)
```

Expected: no output. Any line → STOP and report.

- [ ] **Step 2: Write `lib/context.ts`.**

```ts
'use client'

import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { createContext, use } from 'react'

export interface DataViewContextValue {
  /** Widened once at the root, so every part reads one non-generic shape. */
  query: DataViewQueryResult<unknown, FieldList, string>
  /** Plural ("customers"): the toolbar's live status and the empty copy read it. */
  entityName: string
}

export const DataViewContext = createContext<DataViewContextValue | null>(null)

export function useDataView(): DataViewContextValue {
  const ctx = use(DataViewContext)
  if (!ctx) {
    throw new Error('DataView part used outside of <DataView> root')
  }
  return ctx
}

/** Set by `DataViewBoundary`, so a root can tell it has one above it. */
export const DataViewBoundaryContext = createContext(false)
```

- [ ] **Step 3: Move the two files with `git mv`, then edit the boundary.**

```bash
mkdir -p src/shared/components/data-view/ui
git mv src/shared/components/data-view-boundary.tsx src/shared/components/data-view/ui/boundary.tsx
git mv src/shared/components/data-view-pending.tsx src/shared/components/data-view/ui/pending.tsx
```

`git mv` stages the rename; that is expected and is committed by path in Step 6. Then make `ui/boundary.tsx` read (the only changes are the pending import path and the outer `DataViewBoundaryContext`, which wraps all three renderings: children, suspense fallback and error fallback):

```tsx
'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { DataViewBoundaryContext } from '@/shared/components/data-view/lib/context'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'
import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

/**
 * Wraps one data view. Its loading state is the view itself, with its cached rows or none (see `DataViewPendingContext`),
 * so the swap to the real rows moves nothing. A failed read shows a retry above the row-less view, so the toolbar stays
 * live: a key that keeps failing is escaped by changing a filter, which changes the URL and clears the error.
 */
export function DataViewBoundary({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  return (
    <DataViewBoundaryContext value>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            resetKeys={[searchParams.toString()]}
            fallbackRender={({ resetErrorBoundary }) => (
              <>
                <HydrationErrorFallback variant="section" onRetry={resetErrorBoundary} />
                <DataViewPendingContext value="error">
                  <div className="contents" data-slot="data-view-error">{children}</div>
                </DataViewPendingContext>
              </>
            )}
          >
            <Suspense fallback={<DataViewPending>{children}</DataViewPending>}>
              {children}
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </DataViewBoundaryContext>
  )
}
```

`ui/pending.tsx` content is unchanged.

- [ ] **Step 4: Re-point every importer.**

```bash
grep -rln "@/shared/components/data-view-boundary'" src | xargs sed -i "s#@/shared/components/data-view-boundary'#@/shared/components/data-view/ui/boundary'#"
grep -rln "@/shared/components/data-view-pending'" src | xargs sed -i "s#@/shared/components/data-view-pending'#@/shared/components/data-view/ui/pending'#"
grep -rn "components/data-view-boundary\|components/data-view-pending" src   # expect no output
git diff --shortstat   # sed -i keeps CRLF files CRLF; a whole-file diff on any file means line endings changed: STOP
```

Then let the import sorter settle the moved lines: `pnpm exec eslint --fix <every file the two greps listed> src/shared/components/data-view`.

- [ ] **Step 5: Verify.**

```bash
pnpm tsc 2>&1 | tail -5          # expect no errors
pnpm exec eslint src/shared/components/data-view $(git diff --name-only -- src)   # expect clean
```

Then open `/dashboard/meetings` and `/dashboard/proposals` on the dev server once each (or run `timeout 590 node $W/check-return.mjs`): no page errors. Nothing reads `DataViewBoundaryContext` yet.

- [ ] **Step 6: Commit by path.**

```bash
git commit -m "refactor(data-view): move the boundary and pending view into shared/components/data-view; the boundary marks its subtree

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/components/data-view src/shared/components/data-view-boundary.tsx src/shared/components/data-view-pending.tsx <every importer from Step 4>
git show --stat HEAD
```

---

### Task 2: The parts

**Files:**
- Create: `src/shared/components/data-view/ui/root.tsx`, `ui/bar.tsx`, `ui/title.tsx`, `ui/count.tsx`, `ui/toolbar.tsx`, `ui/body.tsx`, `ui/empty.tsx`
- Create: `src/shared/components/data-view/data-view.tsx`
- Modify: `src/shared/dal/client/lib/types.ts` (the two `isPending` doc lines, ~133 and ~214)
- Modify: `src/shared/components/query-toolbar/ui/root.tsx:19` (doc says singular; the code has always passed the plural)
- Test: `.superpowers/sdd/2026-10-13-data-view-phase-1/check-data-view-parts.tsx` (git-ignored workspace, not committed)

**Interfaces:**
- Consumes: Task 1's `DataViewContext`, `useDataView`, `DataViewBoundaryContext`, `DataViewBoundary`.
- Produces: `DataView` from `@/shared/components/data-view/data-view`, equal to `Object.assign(DataViewRoot, { Bar, Title, Count, Toolbar, Body, Empty, Boundary })`.
  - `<DataView query entityName>`: `query: DataViewQueryResult<TRow, F, T, K>`, `entityName: string`, `children: ReactNode`.
  - `<DataView.Bar className?>` is `PageBar`.
  - `<DataView.Title as?: 'h1'|'h2'|'h3'|'h4' className?>` (default `h2`).
  - `<DataView.Count className?>`.
  - `<DataView.Toolbar className?>` wraps `QueryToolbar`'s root.
  - `<DataView.Body empty? className?>`, where `empty?: true | { title?: string, description?: string } | ReactElement`.
  - `<DataView.Empty title? description? children?>`.
  - `DataView.Boundary` is `DataViewBoundary`.

- [ ] **Step 1: `git status --short src/shared/dal/client/lib/types.ts src/shared/components/query-toolbar/ui/root.tsx`.** Expect no output.

- [ ] **Step 2: Write the failing check** at `$W/check-data-view-parts.tsx`. It renders to a string, the same way the instant-tab-return checks did.

```tsx
import type { ReactNode } from 'react'

let failed = false
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`)
  failed ||= !ok
}

async function main() {
  const { renderToString } = await import('react-dom/server')
  const { DataView } = await import('@/shared/components/data-view/data-view')
  const { DataViewBoundaryContext } = await import('@/shared/components/data-view/lib/context')
  const { DataViewPendingContext } = await import('@/shared/dal/client/lib/data-view-pending-context')

  type Q = Parameters<typeof DataView>[0]['query']
  const noop = () => {}
  function query(over: Partial<{ rows: unknown[], total: number, isPending: boolean, isStale: boolean, isFetching: boolean, activeFilterCount: number, search: string }> = {}): Q {
    const { rows = [{ id: 'r1' }], total = 1, isPending = false, isStale = false, isFetching = false, activeFilterCount = 0, search = '' } = over
    return {
      rows,
      total,
      isPending,
      isStale,
      isFetching,
      refresh: async () => {},
      filterSort: { fields: {}, toolbar: [], filters: {}, options: {}, activeFilterCount, setFilter: noop, clearFilters: noop, search, setSearch: noop, sortBy: undefined, sortDir: undefined, setSort: noop },
      window: { kind: 'whole-list' },
    } as unknown as Q
  }
  function render(q: Q, node: ReactNode, pending: false | 'loading' | 'error' = false) {
    return renderToString(
      <DataViewBoundaryContext value>
        <DataViewPendingContext value={pending}>
          <DataView query={q} entityName="meetings">{node}</DataView>
        </DataViewPendingContext>
      </DataViewBoundaryContext>,
    )
  }
  const ROWS = <table data-probe="rows" />

  // Root
  let threw = ''
  try {
    renderToString(<DataView query={query()} entityName="meetings"><i /></DataView>)
  }
  catch (error) {
    threw = (error as Error).message
  }
  check('root throws in development without a boundary', threw.includes('<DataView> needs a <DataViewBoundary> above it'), threw)
  const env = process.env as Record<string, string | undefined>
  const nodeEnv = env.NODE_ENV
  env.NODE_ENV = 'production'
  let prodHtml = ''
  try {
    prodHtml = renderToString(<DataView query={query()} entityName="meetings"><i data-probe="ok" /></DataView>)
  }
  finally {
    env.NODE_ENV = nodeEnv
  }
  check('root renders in production without a boundary', prodHtml.includes('data-probe="ok"'))

  // Count
  check('count is the number only', render(query({ total: 1234 }), <DataView.Count />).includes('>1,234</span>'))
  check('count says Loading… while pending', render(query({ isPending: true, rows: [] }), <DataView.Count />).includes('Loading…'))
  check('count with cached rows in a loading screen shows their count', render(query({ total: 7 }), <DataView.Count />, 'loading').includes('>7</span>'))
  check('count renders nothing in the error fallback', !render(query({ isPending: true, rows: [] }), <DataView.Count />, 'error').includes('data-view-count'))

  // Title
  check('title defaults to h2', render(query(), <DataView.Title>Meetings</DataView.Title>).startsWith('<h2'))
  check('title takes as', render(query(), <DataView.Title as="h3">Meetings</DataView.Title>).startsWith('<h3'))

  // Body: stale rule
  const stale = render(query({ isStale: true }), <DataView.Body empty>{ROWS}</DataView.Body>)
  check('body marks stale rows', stale.includes('data-stale="true"') && stale.includes('aria-busy="true"'))
  const refreshing = render(query({ isFetching: true }), <DataView.Body empty>{ROWS}</DataView.Body>)
  check('a refresh never marks stale (no dim)', !refreshing.includes('data-stale') && refreshing.includes('aria-busy="true"'))
  const idle = render(query(), <DataView.Body empty>{ROWS}</DataView.Body>)
  check('idle body has no stale or busy marks', !idle.includes('data-stale') && !idle.includes('aria-busy'))
  check('body carries the dim class and the fill cell', idle.includes('data-[stale=true]:opacity-60') && idle.includes('min-h-0') && idle.includes('flex-1'))
  check('body never clips x', !/overflow-(hidden|clip|x-)/.test(idle))

  // Body: empty rule
  check('empty result shows Empty', render(query({ rows: [], total: 0 }), <DataView.Body empty>{ROWS}</DataView.Body>).includes('No meetings'))
  check('empty while pending keeps the body (skeleton)', render(query({ rows: [], isPending: true }), <DataView.Body empty>{ROWS}</DataView.Body>).includes('data-probe="rows"'))
  check('empty while stale keeps the body', render(query({ rows: [], isStale: true }), <DataView.Body empty>{ROWS}</DataView.Body>).includes('data-probe="rows"'))
  check('no empty prop keeps the body', render(query({ rows: [] }), <DataView.Body>{ROWS}</DataView.Body>).includes('data-probe="rows"'))
  check('a cached empty result in a loading screen shows Empty', render(query({ rows: [], total: 0 }), <DataView.Body empty>{ROWS}</DataView.Body>, 'loading').includes('No meetings'))
  check('error fallback keeps the row-less body, no Empty', (() => {
    const html = render(query({ rows: [], isPending: true }), <DataView.Body empty>{ROWS}</DataView.Body>, 'error')
    return html.includes('data-probe="rows"') && !html.includes('No meetings')
  })())
  check('empty takes copy', render(query({ rows: [] }), <DataView.Body empty={{ title: 'No customers', description: 'Start by scheduling meetings with customers' }}>{ROWS}</DataView.Body>).includes('Start by scheduling meetings with customers'))
  check('empty takes a node', render(query({ rows: [] }), <DataView.Body empty={<p data-probe="custom" />}>{ROWS}</DataView.Body>).includes('data-probe="custom"'))

  // Empty copy
  check('empty default copy', (() => {
    const html = render(query({ rows: [] }), <DataView.Empty />)
    return html.includes('No meetings') && !html.includes('match these filters')
  })())
  check('empty filtered copy (filter)', render(query({ rows: [], activeFilterCount: 1 }), <DataView.Empty description="unused" />).includes('No meetings match these filters'))
  check('empty filtered copy (search)', render(query({ rows: [], search: 'zz' }), <DataView.Empty />).includes('No meetings match these filters'))
  check('empty given description when unfiltered', render(query({ rows: [] }), <DataView.Empty description="Book one" />).includes('Book one'))

  if (failed) {
    process.exitCode = 1
  }
}

void main()
```

- [ ] **Step 3: Run it and see it fail.**

```bash
TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-data-view-parts.tsx > $W/task-2-red.txt 2>&1; echo "exit $?"
```

Expected: a non-zero exit that names `@/shared/components/data-view/data-view` as missing.

- [ ] **Step 4: Write the parts.**

`ui/root.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { DataViewContextValue } from '@/shared/components/data-view/lib/context'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { DataViewWindowKind } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { use, useMemo } from 'react'

import { DataViewBoundaryContext, DataViewContext } from '@/shared/components/data-view/lib/context'

interface DataViewRootProps<TRow, F extends FieldList, T extends ToolbarFilterId<F>, K extends DataViewWindowKind> {
  query: DataViewQueryResult<TRow, F, T, K>
  /** Plural ("customers"), as the toolbar's live status reads it. */
  entityName: string
  children: ReactNode
}

export function DataViewRoot<TRow, F extends FieldList, T extends ToolbarFilterId<F>, K extends DataViewWindowKind>({ query, entityName, children }: DataViewRootProps<TRow, F, T, K>) {
  const hasBoundary = use(DataViewBoundaryContext)
  // The hook returns a new object every render, but each field is already stable, so the value is keyed on the fields.
  const { rows, total, isPending, isStale, isFetching, refresh, filterSort, window: viewWindow } = query
  const value = useMemo((): DataViewContextValue => ({
    query: { rows, total, isPending, isStale, isFetching, refresh, filterSort, window: viewWindow } as unknown as DataViewContextValue['query'],
    entityName,
  }), [rows, total, isPending, isStale, isFetching, refresh, filterSort, viewWindow, entityName])

  // Without a boundary, a failed read or a row that fails to render takes the whole app down instead of this view.
  if (!hasBoundary && process.env.NODE_ENV !== 'production') {
    throw new Error('<DataView> needs a <DataViewBoundary> above it')
  }

  return <DataViewContext value={value}>{children}</DataViewContext>
}
```

If `DataViewWindowKind` is exported from somewhere other than `data-view-query-config`, import it from where `src/shared/dal/client/lib/types.ts` imports it.

`ui/bar.tsx`:

```tsx
export { PageBar as DataViewBar } from '@/shared/components/page-bar'
```

`ui/title.tsx`:

```tsx
import type { ReactNode } from 'react'

interface DataViewTitleProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  className?: string
  children: ReactNode
}

export function DataViewTitle({ as: Tag = 'h2', className, children }: DataViewTitleProps) {
  return <Tag className={className}>{children}</Tag>
}
```

`ui/count.tsx`:

```tsx
'use client'

import { use } from 'react'

import { useDataView } from '@/shared/components/data-view/lib/context'
import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { formatTotalCount } from '@/shared/lib/pagination-format'

export function DataViewCount({ className }: { className?: string }) {
  const { query } = useDataView()
  // The error fallback has no rows and no total; "Loading…" under a retry would say the opposite of the retry.
  if (use(DataViewPendingContext) === 'error') {
    return null
  }
  return (
    <span data-slot="data-view-count" className={className}>
      {query.isPending ? 'Loading…' : formatTotalCount(query.total)}
    </span>
  )
}
```

`ui/toolbar.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { useDataView } from '@/shared/components/data-view/lib/context'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

export function DataViewToolbar({ className, children }: { className?: string, children: ReactNode }) {
  const { query, entityName } = useDataView()
  return (
    <QueryToolbar query={query} entityName={entityName} className={className}>
      {children}
    </QueryToolbar>
  )
}
```

`ui/empty.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { useDataView } from '@/shared/components/data-view/lib/context'
import { EmptyState } from '@/shared/components/states/empty-state'

interface DataViewEmptyProps {
  title?: string
  description?: string
  children?: ReactNode
}

export function DataViewEmpty({ title, description, children }: DataViewEmptyProps) {
  const { query, entityName } = useDataView()
  const isFiltered = query.filterSort.activeFilterCount > 0 || query.filterSort.search !== ''
  return (
    <EmptyState title={title ?? `No ${entityName}`} description={isFiltered ? `No ${entityName} match these filters` : description}>
      {children}
    </EmptyState>
  )
}
```

`ui/body.tsx`:

```tsx
'use client'

import type { ReactElement, ReactNode } from 'react'

import { isValidElement } from 'react'

import { useDataView } from '@/shared/components/data-view/lib/context'
import { DataViewEmpty } from '@/shared/components/data-view/ui/empty'
import { cn } from '@/shared/lib/utils'

interface DataViewBodyProps {
  /** `true` for the default copy, copy of its own, or a node. Without it the children always render (a calendar keeps its grid). */
  empty?: true | { title?: string, description?: string } | ReactElement
  className?: string
  children: ReactNode
}

export function DataViewBody({ empty, className, children }: DataViewBodyProps) {
  const { query } = useDataView()
  // A stale or pending empty result belongs to another key or to nothing yet; saying "no match" for it would be false.
  const showsEmpty = empty !== undefined && query.rows.length === 0 && !query.isPending && !query.isStale
  return (
    // Only rows of another key dim; a refresh of these rows stays at full strength and the toolbar's hairline says so.
    // No x clipping here: the bodies bleed to the screen edge through this cell.
    <div
      data-slot="data-view-body"
      data-stale={query.isStale || undefined}
      aria-busy={query.isStale || query.isFetching || undefined}
      className={cn('min-h-0 flex-1 transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200', className)}
    >
      {showsEmpty ? renderEmpty(empty) : children}
    </div>
  )
}

function renderEmpty(empty: NonNullable<DataViewBodyProps['empty']>) {
  if (empty === true) {
    return <DataViewEmpty />
  }
  if (isValidElement(empty)) {
    return empty
  }
  return <DataViewEmpty title={empty.title} description={empty.description} />
}
```

`renderEmpty` is a module-private helper rather than a component, so the one-component-per-file rule holds.

`data-view.tsx`:

```tsx
'use client'

import { DataViewBar } from '@/shared/components/data-view/ui/bar'
import { DataViewBody } from '@/shared/components/data-view/ui/body'
import { DataViewBoundary } from '@/shared/components/data-view/ui/boundary'
import { DataViewCount } from '@/shared/components/data-view/ui/count'
import { DataViewEmpty } from '@/shared/components/data-view/ui/empty'
import { DataViewRoot } from '@/shared/components/data-view/ui/root'
import { DataViewTitle } from '@/shared/components/data-view/ui/title'
import { DataViewToolbar } from '@/shared/components/data-view/ui/toolbar'

export const DataView = Object.assign(DataViewRoot, {
  Bar: DataViewBar,
  Title: DataViewTitle,
  Count: DataViewCount,
  Toolbar: DataViewToolbar,
  Body: DataViewBody,
  Empty: DataViewEmpty,
  Boundary: DataViewBoundary,
})
```

- [ ] **Step 5: Fix the two docs.**

In `src/shared/dal/client/lib/types.ts`, change both `isPending` lines (one in `PaginatedQueryResult`, one in `DataViewQueryResult`) from

```ts
  /** True when there are no rows to show: a pending view with nothing cached, so the view draws its skeleton. */
```

to

```ts
  /** True when there are no rows to show: a pending view with nothing cached (the view draws its skeleton) or an error fallback (row-less). */
```

In `src/shared/components/query-toolbar/ui/root.tsx`, change

```ts
  /** Singular noun for the records this toolbar filters (e.g. "proposal"). */
```

to

```ts
  /** Plural noun for the records this toolbar filters (e.g. "proposals"), as the live status reads it. */
```

- [ ] **Step 6: Run the check and see it pass.**

```bash
TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-data-view-parts.tsx > $W/task-2-green.txt 2>&1; echo "exit $?"; grep -c PASS $W/task-2-green.txt; grep FAIL $W/task-2-green.txt
```

Expected: exit 0, 25 PASS, no FAIL. If tsx ignores the workspace `tsconfig.json` (`jsx: react-jsx`), its `include` already lists `./*.tsx`, which is what made it apply last time.

- [ ] **Step 7: Type-check and lint.**

```bash
pnpm tsc 2>&1 | tail -5
pnpm exec eslint src/shared/components/data-view src/shared/dal/client/lib/types.ts src/shared/components/query-toolbar/ui/root.tsx
```

Expected: clean. If `QueryToolbar`'s root rejects the widened `DataViewQueryResult<unknown, FieldList, string>` (spec §3.4 says its generic accepts it), STOP and report the tsc error; don't cast at the callsite.

- [ ] **Step 8: Commit by path.**

```bash
git commit -m "feat(data-view): the DataView compound: root, bar, title, count, toolbar, body, empty

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/components/data-view src/shared/dal/client/lib/types.ts src/shared/components/query-toolbar/ui/root.tsx
git show --stat HEAD
```

---

### Task 3: `EntityRecordsTable` on the parts, `DataTable` without its own dim and empty row

Meetings and projects move here with no edits of their own. Until Task 4 lands, proposals still renders `RecordsPageShell` and so has no dim and no empty row for one commit. That only affects local main.

**Files:**
- Create: `src/shared/components/data-table/types/entity-table-result.ts`
- Modify: `src/shared/components/entity-records-table.tsx` (whole file)
- Modify: `src/shared/components/data-table/ui/data-table.tsx:306-313`
- Modify: `src/shared/components/data-table/ui/data-table-body.tsx:78-106`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx:134-149`
- Delete: `src/shared/components/data-view-type-toggle.tsx` (no importers: `grep -rn "data-view-type-toggle\|DataViewTypeToggle" src` lists only itself)

**Interfaces:**
- Consumes: `DataView` (Task 2).
- Produces: `EntityTableResult<TRow, TMeta, F, T>` from `@/shared/components/data-table/types/entity-table-result`, replacing `EntityRecordsTableSource`, with the same four fields.

- [ ] **Step 1: `git status --short` on every file above.** Expect no output.

- [ ] **Step 2: The type.** `src/shared/components/data-table/types/entity-table-result.ts`:

```ts
import type { ReactNode } from 'react'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/** What an entity table hook returns: `useEntityTable`'s result plus the entity's dialogs. */
export interface EntityTableResult<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<TRow, F, T>
  visibility: UseColumnVisibilityResult
  dataTableProps: DataTableProps<TRow, TMeta>
  dialogs: ReactNode
}
```

- [ ] **Step 3: Rebuild `entity-records-table.tsx`.**

```tsx
'use client'

import type { ReactNode } from 'react'

import type { EntityTableResult } from '@/shared/components/data-table/types/entity-table-result'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { DataView } from '@/shared/components/data-view/data-view'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

interface EntityRecordsTableProps<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  title: string
  /** Plural, for the toolbar's counts ("projects"). */
  entityName: string
  searchPlaceholder: string
  headerActions?: ReactNode
  /** An entity table hook's result, passed whole. */
  table: EntityTableResult<TRow, TMeta, F, T>
}

/** One records page: the header with its count, the standard toolbar and the table. */
export function EntityRecordsTable<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>>({
  title,
  entityName,
  searchPlaceholder,
  headerActions,
  table,
}: EntityRecordsTableProps<TRow, TMeta, F, T>) {
  return (
    <DataView query={table.query} entityName={entityName}>
      {table.dialogs}
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <DataView.Bar>
          {/* The row is always one button tall, so a page with actions sits at the same height as one without. */}
          <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <DataView.Title className="text-lg font-semibold tracking-tight">{title}</DataView.Title>
              <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
            </div>
            {headerActions && <div className="ml-auto flex items-center gap-2">{headerActions}</div>}
          </header>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder={searchPlaceholder} visibility={table.visibility} />
          </DataView.Toolbar>
        </DataView.Bar>
        <DataView.Body empty>
          <DataTable {...table.dataTableProps} />
        </DataView.Body>
      </div>
    </DataView>
  )
}
```

- [ ] **Step 4: `DataTable` drops its dim.** In `data-table.tsx`, delete the dim comment (lines 306-307) and replace the `<Table …>` opening (308-313) with:

```tsx
            <Table
              className="table-fixed border-separate border-spacing-0"
              style={{ width: totalDeclaredWidth, minWidth: '100%' }}
            >
```

`aria-busy` and `data-stale` move to `DataView.Body`. Keep the "Fills the container or overflows it in CSS alone…" comment (line 305).

- [ ] **Step 5: `DataTableBody` drops the empty row.** In the IIFE at `data-table-body.tsx:78-106`, keep the skeleton branch and replace the final `return (<TableRow>…No … match your filter.</TableRow>)` with `return null`, so the block reads:

```tsx
      {(() => {
        if (rows.length > 0) {
          return null
        }
        // A stale empty result is the previous key's; saying "no match" for the key still loading would be false.
        if (serverPagination?.isFetching || serverPagination?.isStale) {
          const visibleCols = table.getVisibleFlatColumns()
          return Array.from({ length: 5 }).map((_, rowIdx) => (
            // eslint-disable-next-line react/no-array-index-key -- static skeleton list, no reordering
            <TableRow key={`skeleton-row-${rowIdx}`} className={cn('hover:bg-transparent', rowIdx % 2 === 1 && 'bg-band hover:bg-band', skeletonRowClassName)}>
              {visibleCols.map((col, colIdx) => (
                <TableCell key={`skeleton-${rowIdx}-${col.id}`}>
                  <Skeleton className={cn('h-3.5', SKELETON_CELL_WIDTHS[colIdx % SKELETON_CELL_WIDTHS.length])} />
                </TableCell>
              ))}
            </TableRow>
          ))
        }
        // The empty state is the data view's, drawn in place of the whole table.
        return null
      })()}
```

`columnCount` and `entityName` stay in `DataTableBodyProps`, because `entityName` still keys `detailId`. If `columnCount` ends up unused, remove it from the props and from its one caller in `data-table.tsx`. tsc and lint will flag it.

- [ ] **Step 6: Campaign leads on `DataView`** (owner confirm #2, spec §11 #17). In `campaigns-leads-view.tsx`, add `import { DataView } from '@/shared/components/data-view/data-view'`, wrap the returned tree in `<DataView query={toolbarQuery} entityName="leads">`, and replace the table's fill `div` (`<div className="min-h-0 flex-1">` around `<DataTable … />`) with `<DataView.Body empty>…</DataView.Body>`. `LeadsFilterBar`, the bulk bar and the drawer stay as children, in place. The boundary is already above it (`campaigns-view.tsx:42-44`).

- [ ] **Step 7: Delete the toggle.**

```bash
git rm src/shared/components/data-view-type-toggle.tsx
grep -rn "EntityRecordsTableSource\|DataViewTypeToggle\|data-view-type-toggle" src   # expect no output
```

- [ ] **Step 8: Verify.**

```bash
pnpm tsc 2>&1 | tail -5
pnpm exec eslint src/shared/components/entity-records-table.tsx src/shared/components/data-table src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx
TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-data-view-parts.tsx | grep -c PASS   # still 25
for p in meetings projects; do node scripts/perf/records-probe.mjs /dashboard/$p > $W/probe-task3-$p.txt 2>&1; done
diff <(grep -E "^=== |row renders" $W/probe-before-meetings.txt) <(grep -E "^=== |row renders" $W/probe-task3-meetings.txt)
diff <(grep -E "^=== |row renders" $W/probe-before-projects.txt) <(grep -E "^=== |row renders" $W/probe-task3-projects.txt)
```

Expected: tsc and lint clean. In the probe, "expand" re-renders one row and "modal open" re-renders none, as in the baseline. Render milliseconds vary between dev runs, so compare row-render counts, not times. If a count rose, STOP and report: the root's memo or a part is re-rendering rows.

Then open `/dashboard/meetings` and `/dashboard/projects` in the dev browser and confirm the same rows, count, toolbar and New Project button as before, with no console error. Check `/dashboard/campaigns?tab=leads` the same way.

- [ ] **Step 9: Commit by path.**

```bash
git commit -m "refactor(data-view): EntityRecordsTable composes the DataView parts; DataTable leaves the stale dim and the empty state to the view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/components/entity-records-table.tsx src/shared/components/data-table/types/entity-table-result.ts src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-body.tsx src/shared/components/data-view-type-toggle.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx
git show --stat HEAD
```

---

### Task 4: Proposals composes the parts and moves onto the loading-screen rule

**Files:**
- Create: `src/features/records-management/ui/views/proposals-records-view.tsx`
- Modify: `src/features/proposal-flow/ui/components/table/index.tsx` (imports, and the return at `:138-177`)
- Modify: `src/app/(frontend)/dashboard/(records)/proposals/page.tsx`
- Modify: `src/app/(frontend)/dashboard/(records)/proposals/loading.tsx`
- Modify: `src/features/agent-dashboard/constants/route-pending-views.ts:16`
- Delete: `src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx`

**Interfaces:**
- Consumes: `DataView` (Task 2), `DataViewBoundary` and `DataViewPending` (Task 1).
- Produces: `ProposalsRecordsView()`, which is the proposals route's one component for the page, `loading.tsx` and the layout's map entry (spec §3.8).

- [ ] **Step 1: `git status --short` on every file above.** Expect no output.

- [ ] **Step 2: The view.** `proposals-records-view.tsx`:

```tsx
'use client'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { DataViewBoundary } from '@/shared/components/data-view/ui/boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

export function ProposalsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <PastProposalsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
```

- [ ] **Step 3: The route renders it in all three places.**

`proposals/page.tsx`: remove the `PastProposalsTable`, `DataViewBoundary` and `RecordsPageFrame` imports, add `import { ProposalsRecordsView } from '@/features/records-management/ui/views/proposals-records-view'`, and return:

```tsx
  return (
    <HydrateClient>
      <ProposalsRecordsView />
    </HydrateClient>
  )
```

`proposals/loading.tsx`:

```tsx
import { ProposalsRecordsView } from '@/features/records-management/ui/views/proposals-records-view'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'

export default function ProposalsLoading() {
  return (
    <DataViewPending>
      <ProposalsRecordsView />
    </DataViewPending>
  )
}
```

`route-pending-views.ts:16`:

```ts
  [ROOTS.dashboard.proposals.root()]: dynamic(() => import('@/features/records-management/ui/views/proposals-records-view').then(m => m.ProposalsRecordsView)),
```

```bash
git rm src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx
grep -rn "ProposalsRoutePendingView\|proposals-route-pending-view" src   # expect no output
```

- [ ] **Step 4: The table composes the parts.** In `table/index.tsx`, remove the `RecordsPageHeader` and `RecordsPageShell` imports, add `import { DataView } from '@/shared/components/data-view/data-view'`, and replace the returned tree (from `return (` through the closing `)` of the component) with:

```tsx
  return (
    <DataView query={query} entityName="proposals">
      <DeleteConfirmDialog />
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <DataView.Bar>
          {/* The row is always one button tall, so it sits at the same height as the pages with actions. */}
          <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <DataView.Title className="text-lg font-semibold tracking-tight">Proposals</DataView.Title>
              <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
            </div>
          </header>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder="Search by label or customer…" visibility={visibility} />
          </DataView.Toolbar>
        </DataView.Bar>
        <DataView.Body empty>
          <DataTable
            tableId="proposals"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            entityName="proposal"
            rowDataAttribute="data-proposal-row"
            skeletonRowClassName="h-[58.5px]"
            serverPagination={toDataTablePagination(query)}
            serverSorting={toDataTableSorting(query)}
            columnVisibility={visibility.columnVisibility}
          />
        </DataView.Body>
      </div>

      {projectPrompt && (
        <CreateProjectModal
          isOpen
          customerId={projectPrompt.customerId}
          customerName={projectPrompt.customerName}
          proposalId={projectPrompt.proposalId}
          meetingId={projectPrompt.meetingId}
          onSuccess={handleProjectCreated}
          onClose={() => setProjectPrompt(null)}
        />
      )}
    </DataView>
  )
```

`query` here is `fromPaginatedQuery(pagination)`, which builds new `filterSort` and `window` objects every render. The root's memo therefore refreshes every render, exactly as `QueryToolbar`'s root does today, so render cost doesn't change. Don't add a `useMemo` around it: R3 replaces this read with `useEntityTable`.

- [ ] **Step 5: Verify.**

```bash
pnpm tsc 2>&1 | tail -5
pnpm exec eslint src/features/records-management/ui/views/proposals-records-view.tsx src/features/proposal-flow/ui/components/table/index.tsx "src/app/(frontend)/dashboard/(records)/proposals" src/features/agent-dashboard/constants/route-pending-views.ts
grep -rln "RecordsPageShell\|RecordsPageHeader" src   # expect only records-page-shell.tsx, records-page-header.tsx, customers-table.tsx
node scripts/perf/records-probe.mjs /dashboard/proposals > $W/probe-task4-proposals.txt 2>&1
diff <(grep -E "^=== |row renders" $W/probe-before-proposals.txt) <(grep -E "^=== |row renders" $W/probe-task4-proposals.txt)
timeout 590 node $W/check-return.mjs > $W/task-4-return.txt 2>&1; echo "exit $?"
timeout 400 node $W/check-error-return.mjs > $W/task-4-error-return.txt 2>&1; echo "exit $?"
```

Expected:
- tsc and lint are clean.
- Row-render counts are unchanged.
- `check-return` passes for every route, including `quick return → proposals` with no hairline and no skeleton-without-rows.
- `check-error-return` passes 4/4: the proposals bad row stays inside its view now that the loading screen is the page's own component.

- [ ] **Step 6: Commit by path.**

```bash
git commit -m "refactor(proposals): the records table composes the DataView parts; page, loading screen and layout entry render one ProposalsRecordsView

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/records-management/ui/views/proposals-records-view.tsx src/features/proposal-flow/ui/components/table/index.tsx "src/app/(frontend)/dashboard/(records)/proposals/page.tsx" "src/app/(frontend)/dashboard/(records)/proposals/loading.tsx" src/features/agent-dashboard/constants/route-pending-views.ts src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx
git show --stat HEAD
```

---

### Task 5: Phase verification and the tracker row

**Files:**
- Test: `$W/check-states.mjs` (workspace, not committed)
- Modify: `docs/plans/2026-10-12-data-views-epic.md` (the DV3 row only)

- [ ] **Step 1: Write `$W/check-states.mjs`.** It forces the empty, stale, refresh and error states read-only and screenshots each one once.

```js
import process from 'node:process'
import { openPage, redact } from './check-lib.mjs'

const W = '.superpowers/sdd/2026-10-13-data-view-phase-1'
// Read procedures per route: a request whose URL names one is the view's own list read.
const ROUTES = {
  meetings: { path: '/dashboard/meetings', entity: 'meetings', proc: 'meetingsRouter.reads.list', row: 'tbody tr[data-meeting-row]' },
  projects: { path: '/dashboard/projects', entity: 'projects', proc: 'projectsRouter.crud.list', row: 'tbody tr[data-project-row]' },
  proposals: { path: '/dashboard/proposals', entity: 'proposals', proc: 'proposalsRouter.business.list', row: 'tbody tr[data-proposal-row]' },
}
const NO_MATCH = 'zzqx-no-such-record'
let failed = false
const verdict = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  failed ||= !ok
}
const body = '[data-slot="data-view-body"]'

for (const [name, r] of Object.entries(ROUTES)) {
  for (const width of [1440, 390]) {
    const { browser, page, errors } = await openPage(r.path, '', { viewport: { width, height: 900 } })
    try {
      await page.waitForSelector(r.row, { timeout: 120000 })
      const search = page.locator(`input[aria-label="Search ${r.entity}"]`).first()

      // Stale: the next key loads slowly, so the shown rows belong to the previous key and dim after 200 ms.
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1500, downloadThroughput: 60000, uploadThroughput: -1 })
      await search.fill('a')
      await page.waitForSelector(`${body}[data-stale="true"]`, { timeout: 10000 })
      await page.waitForTimeout(600)
      const stale = await page.$eval(body, el => ({ opacity: getComputedStyle(el).opacity, pe: getComputedStyle(el).pointerEvents, busy: el.getAttribute('aria-busy') }))
      verdict(`${name}@${width} stale rows dim, stay clickable`, stale.opacity === '0.6' && stale.pe !== 'none' && stale.busy === 'true', JSON.stringify(stale))
      await page.screenshot({ path: `${W}/states-${name}-${width}-stale.png` })
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
      await page.waitForSelector(`${body}:not([data-stale])`, { timeout: 60000 })

      // Refresh: fresh rows refetch with no dim.
      await page.getByRole('button', { name: 'Refresh' }).first().click()
      const refresh = await page.$eval(body, el => ({ opacity: getComputedStyle(el).opacity, stale: el.getAttribute('data-stale') }))
      verdict(`${name}@${width} refresh never dims`, refresh.opacity === '1' && refresh.stale === null, JSON.stringify(refresh))

      // Empty: a search that matches nothing shows Empty in place of the table; clearing it brings the rows back.
      await search.fill(NO_MATCH)
      await page.waitForSelector(`${body} >> text=No ${r.entity} match these filters`, { timeout: 60000 })
      verdict(`${name}@${width} empty shows Empty, no table`, (await page.$(`${body} table`)) === null)
      await page.screenshot({ path: `${W}/states-${name}-${width}-empty.png` })
      await search.fill('')
      await page.waitForSelector(r.row, { timeout: 60000 })
      verdict(`${name}@${width} clearing the search escapes Empty`, true)

      // Error: the next key's read fails; the retry shows above a row-less view with no count and no Empty.
      await page.route(url => url.href.includes('/api/trpc/') && url.href.includes(r.proc), route => route.fulfill({ status: 500, body: 'forced' }))
      await search.fill('b')
      await page.getByRole('button', { name: 'Try again' }).first().waitFor({ timeout: 90000 })
      const err = await page.evaluate(() => ({
        count: !!document.querySelector('[data-slot="data-view-error"] [data-slot="data-view-count"]'),
        empty: !!document.querySelector('[data-slot="data-view-error"] [data-slot="data-view-body"] .border-dashed'),
      }))
      verdict(`${name}@${width} error: retry, no count, no Empty`, !err.count && !err.empty, JSON.stringify(err))
      await page.screenshot({ path: `${W}/states-${name}-${width}-error.png` })
      await page.unrouteAll()
      await search.fill('')
      await page.waitForSelector(r.row, { timeout: 60000 })
      verdict(`${name}@${width} a search change escapes the error`, true)

      verdict(`${name}@${width} no page errors`, errors.length === 0, errors.join(' | '))
    }
    catch (error) {
      verdict(`${name}@${width} ran`, false, redact(error.message).split('\n')[0])
    }
    finally {
      await browser.close()
    }
  }
}
process.exit(failed ? 1 : 0)
```

If `openPage`'s signature in the copied `check-lib.mjs` differs from `openPage(redirect, extra, { viewport })`, adapt the call to it and leave `check-lib.mjs` unchanged. If the error never surfaces within 90 s (TanStack retries a 5xx), record the timing in `progress.md` and raise the wait. Don't switch to a 4xx fake, which would skip the retry path the app really takes.

- [ ] **Step 2: Run the whole suite.**

```bash
W=.superpowers/sdd/2026-10-13-data-view-phase-1
TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-data-view-parts.tsx > $W/final-parts.txt 2>&1; echo "parts exit $?"
timeout 900 node $W/check-states.mjs > $W/final-states.txt 2>&1; echo "states exit $?"
timeout 590 node $W/check-return.mjs > $W/final-return.txt 2>&1; echo "return exit $?"
timeout 400 node $W/check-error-return.mjs > $W/final-error-return.txt 2>&1; echo "error-return exit $?"
timeout 400 node $W/check-home.mjs > $W/final-home.txt 2>&1; echo "home exit $?"
timeout 400 node $W/check-week-entry.mjs > $W/final-week.txt 2>&1; echo "week exit $?"
node scripts/perf/layout-probe.mjs > $W/final-layout.txt 2>&1; echo "layout exit $?"
for p in meetings projects proposals; do node scripts/perf/records-probe.mjs /dashboard/$p > $W/probe-after-$p.txt 2>&1; done
for p in meetings projects proposals; do diff <(grep -E "^=== |row renders" $W/probe-before-$p.txt) <(grep -E "^=== |row renders" $W/probe-after-$p.txt) && echo "$p rows: same"; done
pnpm tsc 2>&1 | tail -3; echo "tsc exit $?"
pnpm lint > $W/final-lint.log 2>&1; echo "lint exit $?"
```

Expected: every exit is 0 and every probe prints "rows: same". The layout probe confirms `Body` cut no bleed at 390 px.

- [ ] **Step 3: Screenshots for the owner** (spec §8: 1440 and 390, light and dark, super-admin and agent). Run this against meetings, projects and proposals, with `colorScheme` set on the context, and save them as `$W/shot-<route>-<width>-<scheme>-<role>.png`:

```js
// $W/shots.mjs
import { openPage } from './check-lib.mjs'

const W = '.superpowers/sdd/2026-10-13-data-view-phase-1'
for (const route of ['meetings', 'projects', 'proposals']) {
  for (const width of [1440, 390]) {
    for (const scheme of ['light', 'dark']) {
      for (const [role, extra] of [['super-admin', ''], ['agent', '&role=agent']]) {
        const { browser, page } = await openPage(`/dashboard/${route}`, extra, { viewport: { width, height: 900 } })
        await page.emulateMedia({ colorScheme: scheme })
        await page.waitForSelector('tbody tr, [data-slot="data-view-body"] .border-dashed', { timeout: 120000 })
        await page.screenshot({ path: `${W}/shot-${route}-${width}-${scheme}-${role}.png` })
        await browser.close()
      }
    }
  }
}
```

```bash
timeout 900 node $W/shots.mjs; ls $W/shot-*.png | wc -l   # expect 24
```

Look at each screenshot. The header, count, toolbar and table must look as before. The only intended difference is that an empty result shows the dashed `Empty` box where the table was.

- [ ] **Step 4: Tracker row.** `git status --short docs/plans/2026-10-12-data-views-epic.md`; if another session holds changes, STOP. Otherwise set DV3's status cell to:

```
[x] built on local main (`<first>..<last>`), awaiting owner ship; boundary + pending moved to `src/shared/components/data-view/ui/` (docs citing the old path re-checked at DV4)
```

Fill in the range from `git log --oneline` for this plan's four commits. Then add "ships to prod with DV4 (spec §11 #18)". Commit:

```bash
git commit -m "docs(data-views): DV3 built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/plans/2026-10-12-data-views-epic.md
git show --stat HEAD
```

- [ ] **Step 5: Hand back.** Report the four commit ranges, the suite results, the probe comparison, where the screenshots are, and anything recorded in `progress.md`. The final whole-branch review (controller, most capable model) runs over `<first-task-1-commit>^..HEAD`.

---

## Self-review notes

- **Spec coverage (phase 1, §6):**
  - The compound is Tasks 1–2.
  - `EntityRecordsTable` rebuilt, with meetings and projects through it, is Task 3.
  - Proposals by hand is Task 4.
  - `EntityTableResult` is Task 3.
  - The deletions are covered: `DataTable`'s dim and empty row (Task 3), `DataViewTypeToggle` (Task 3), `EntityRecordsTableSource` (Task 3).
  - `RecordsPageShell` and `RecordsPageHeader` stay until R2 Part 2 deletes `customers-table.tsx` (spec §4, §6).
  - Proposals' loading-screen rule (§3.8) is Task 4.
  - §3.1's `entityName` comment fix is Task 2 Step 5, and tracker §7's `isPending` doc is Task 2 Step 5.
  - Spec §8's verification is Task 5.
- **Spec drift found while planning:** spec §1 and §3.1 called proposals `fromPaginatedQuery`'s one caller, but campaign leads is a second. The spec was corrected on 2026-10-14, with campaign leads added to phase 1 as §11 #17 and the ship-with-DV4 ruling as #18.
- **Not in this plan:**
  - Calendars and kanban (DV5, DV6).
  - The customers table and panes (DV4).
  - The records tracker ledger column (owner confirm #5).
  - `CONTEXT.md` glossary (tracker A3).
